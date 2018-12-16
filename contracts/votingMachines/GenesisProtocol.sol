pragma solidity ^0.4.25;

import "./IntVoteInterface.sol";
import { RealMath } from "../libs/RealMath.sol";
import "./VotingMachineCallbacksInterface.sol";
import "./ProposalExecuteInterface.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "openzeppelin-solidity/contracts/ECRecovery.sol";


/**
 * @title GenesisProtocol implementation -an organization's voting machine scheme.
 */
contract GenesisProtocol is IntVoteInterface {
    using SafeMath for uint;
    using RealMath for int216;
    using RealMath for int256;
    using ECRecovery for bytes32;

    enum ProposalState { None ,Closed, Executed, Qued ,PreBoosted,Boosted,QuietEndingPeriod }
    enum ExecutionState { None, QueBarCrossed,QueTimeOut,PreBoostedBarCrossed, BoostedTimeOut,BoostedBarCrossed }

    //Organization's parameters
    struct Parameters {
        uint quedVoteRequiredPercentage; // the absolute vote percentages bar.
        uint quedVotePeriodLimit; //the time limit for a proposal to be in an absolute voting mode.
        uint boostedVotePeriodLimit; //the time limit for a proposal to be in an relative voting mode.
        uint preBoostedVotePeriodLimit; //the time limit for a proposal to be in an preparation state (stable) before boosted.
        uint thresholdConstA;//constant A for threshold calculation . threshold =A * (e ** (numberOfBoostedProposals/B))
        uint quietEndingPeriod; //quite ending period
        uint proposingRepRewardConstA;//constant A for calculate proposer reward. proposerReward =(A*(RTotal) +B*(R+ - R-))/1000
        uint votersReputationLossRatio;//Unsuccessful pre booster voters lose votersReputationLossRatio% of their reputation.
        uint minimumDaoBounty;
        uint daoBountyConst;
        address voteOnBehalf; //this address is allowed to vote of behalf of someone else.
    }
    struct Voter {
        uint vote; // YES(1) ,NO(2)
        uint reputation; // amount of voter's reputation
        bool preBoosted;
    }

    struct Staker {
        uint vote; // YES(1) ,NO(2)
        uint amount; // amount of staker's stake
        //uint amountForBounty; // amount of staker's stake which will be use for bounty calculation
    }

    struct Proposal {
        bytes32 organizationId; // the organization unique identifier the proposal is target to.
        address callbacks;    // should fulfill voting callbacks interface.
        ProposalState state;
        uint winningVote; //the winning vote.
        address proposer;
        uint currentBoostedVotePeriodLimit;
        bytes32 paramsHash;
        uint daoBountyRemain;
        uint daoBounty;
        uint totalStakes;// totalStakes[0] - (amount staked minus fee) - Total number of tokens staked which can be redeemable by stakers.
                           // totalStakes[1] - (amount staked) - Total number of redeemable tokens.
        int threshold;
        uint expirationCallBountyPercentage;
        uint[3] times; //times[0] - sumbmittedTime
                       //times[1] - boostedPhaseTime
                       //times[2] -preBoostedPhaseTime;
        //      vote      reputation
        mapping(uint    =>  uint     ) votes;
        //      vote      reputation
        mapping(uint    =>  uint     ) preBoostedVotes;
        //      address     voter
        mapping(address =>  Voter    ) voters;
        //      vote        stakes
        mapping(uint    =>  uint     ) stakes;
        //      address  staker
        mapping(address  => Staker   ) stakers;
    }

    event Stake(bytes32 indexed _proposalId, address indexed _organization, address indexed _staker,uint _vote,uint _amount);
    event Redeem(bytes32 indexed _proposalId, address indexed _organization, address indexed _beneficiary,uint _amount);
    event RedeemDaoBounty(bytes32 indexed _proposalId, address indexed _organization, address indexed _beneficiary,uint _amount);
    event RedeemReputation(bytes32 indexed _proposalId, address indexed _organization, address indexed _beneficiary,uint _amount);
    event GPExecuteProposal(bytes32 indexed _proposalId, ExecutionState _executionState);
    event ExpirationCallBounty(bytes32 indexed _proposalId, address indexed _beneficiary,uint amount);

    mapping(bytes32=>Parameters) public parameters;  // A mapping from hashes to parameters
    mapping(bytes32=>Proposal) public proposals; // Mapping from the ID of the proposal to the proposal itself.

    uint constant public NUM_OF_CHOICES = 2;
    uint constant public NO = 2;
    uint constant public YES = 1;
    uint public proposalsCnt; // Total number of proposals
    mapping(bytes32=>uint) public orgBoostedProposalsCnt;
          //organizationId => organization
    mapping(bytes32        => address     ) public organizations;
    StandardToken public stakingToken;
    mapping(bytes=>bool) stakeSignatures; //stake signatures
    address constant GEN_TOKEN_ADDRESS = 0x543Ff227F64Aa17eA132Bf9886cAb5DB55DCAddf;
             //organizationId => averageBoostDownstakes
    mapping(bytes32           => uint               ) public averagesBoostDownstakes;
    // Digest describing the data the user signs according EIP 712.
    // Needs to match what is passed to Metamask.
    bytes32 public constant DELEGATION_HASH_EIP712 =
    keccak256(abi.encodePacked("address GenesisProtocolAddress","bytes32 ProposalId", "uint Vote","uint AmountToStake","uint Nonce"));
    // web3.eth.sign prefix
    string public constant ETH_SIGN_PREFIX= "\x19Ethereum Signed Message:\n32";
    /**
     * @dev Constructor
     */
    constructor(StandardToken _stakingToken) public
    {
      //The GEN token (staking token) address is hard coded in the contract by GEN_TOKEN_ADDRESS .
      //This will work for a network which already hosted the GEN token on this address (e.g mainnet).
      //If such contract address does not exist in the network (e.g ganache) the contract will use the _stakingToken param as the
      //staking token address.
        if (isContract(address(GEN_TOKEN_ADDRESS))) {
            stakingToken = StandardToken(GEN_TOKEN_ADDRESS);
        } else {
            stakingToken = _stakingToken;
        }
    }

  /**
   * @dev Check that the proposal is votable (open and not executed yet)
   */
    modifier votable(bytes32 _proposalId) {
        require(_isVotable(_proposalId));
        _;
    }

    /**
     * @dev register a new proposal with the given parameters. Every proposal has a unique ID which is being
     * generated by calculating keccak256 of a incremented counter.
     * @param _numOfChoices number of voting choices
     * @param _paramsHash parameters hash
     * @param _proposer address
     * @param _organization address
     */
    function propose(uint _numOfChoices, bytes32 _paramsHash,address _proposer,address _organization)
        external
        returns(bytes32)
    {
              // Check valid params and number of choices:
        require(_numOfChoices == NUM_OF_CHOICES);
         //Check parameters existence.
        require(parameters[_paramsHash].quedVoteRequiredPercentage > 0);
            // Generate a unique ID:
        bytes32 proposalId = keccak256(abi.encodePacked(this, proposalsCnt));
        proposalsCnt++;
         // Open proposal:
        Proposal memory proposal;
        proposal.callbacks = msg.sender;
        proposal.organizationId = keccak256(abi.encodePacked(msg.sender,_organization));

        proposal.state = ProposalState.Qued;
        // solium-disable-next-line security/no-block-members
        proposal.times[0] = now;
        proposal.currentBoostedVotePeriodLimit = parameters[_paramsHash].boostedVotePeriodLimit;
        proposal.proposer = _proposer;
        proposal.winningVote = NO;
        proposal.paramsHash = _paramsHash;
        if (organizations[proposal.organizationId] == 0) {
            if (_organization == address(0)) {
                organizations[proposal.organizationId] = msg.sender;
            } else {
                organizations[proposal.organizationId] = _organization;
            }
        }
        //calc dao bounty
        uint daoBounty = parameters[_paramsHash].daoBountyConst.mul(averagesBoostDownstakes[proposal.organizationId]);
        if (daoBounty < parameters[_paramsHash].minimumDaoBounty) {
            proposal.daoBountyRemain = parameters[_paramsHash].minimumDaoBounty;
        } else {
            proposal.daoBountyRemain = daoBounty;
        }
        proposal.totalStakes = proposal.daoBountyRemain;
        proposals[proposalId] = proposal;
        proposals[proposalId].stakes[NO] = proposal.daoBountyRemain;//dao downstake on the proposal
        emit NewProposal(proposalId, organizations[proposal.organizationId], _numOfChoices, _proposer, _paramsHash);
        return proposalId;
    }

  /**
   * @dev Cancel a proposal, only the owner can call this function and only if allowOwner flag is true.
   */
    function cancelProposal(bytes32 ) external returns(bool) {
        //This is not allowed.
        return false;
    }

    /**
     * @dev staking function
     * @param _proposalId id of the proposal
     * @param _vote  NO(2) or YES(1).
     * @param _amount the betting amount
     * @return bool true - the proposal has been executed
     *              false - otherwise.
     */
    function stake(bytes32 _proposalId, uint _vote, uint _amount) external returns(bool) {
        return _stake(_proposalId,_vote,_amount,msg.sender);
    }

    /**
     * @dev stakeWithSignature function
     * @param _proposalId id of the proposal
     * @param _vote  NO(2) or YES(1).
     * @param _amount the betting amount
     * @param _nonce nonce value ,it is part of the signature to ensure that
              a signature can be received only once.
     * @param _signatureType signature type
              1 - for web3.eth.sign
              2 - for eth_signTypedData according to EIP #712.
     * @param _signature  - signed data by the staker
     * @return bool true - the proposal has been executed
     *              false - otherwise.
     */
    function stakeWithSignature(
        bytes32 _proposalId,
        uint _vote,
        uint _amount,
        uint _nonce,
        uint _signatureType,
        bytes _signature
        )
        external
        returns(bool)
        {
        require(stakeSignatures[_signature] == false);
        // Recreate the digest the user signed
        bytes32 delegationDigest;
        if (_signatureType == 2) {
            delegationDigest = keccak256(
                abi.encodePacked(
                    DELEGATION_HASH_EIP712, keccak256(
                        abi.encodePacked(
                           address(this),
                          _proposalId,
                          _vote,
                          _amount,
                          _nonce)))
            );
        } else {
            delegationDigest = keccak256(
                abi.encodePacked(
                    ETH_SIGN_PREFIX, keccak256(
                        abi.encodePacked(
                            address(this),
                           _proposalId,
                           _vote,
                           _amount,
                           _nonce)))
            );
        }
        address staker = delegationDigest.recover(_signature);
        //a garbage staker address due to wrong signature will revert due to lack of approval and funds.
        require(staker!=address(0));
        stakeSignatures[_signature] = true;
        return _stake(_proposalId,_vote,_amount,staker);
    }

    /**
     * @dev voting function
     * @param _proposalId id of the proposal
     * @param _vote NO(2) or YES(1).
     * @return bool true - the proposal has been executed
     *              false - otherwise.
     */
    function vote(bytes32 _proposalId, uint _vote,address _voter) external votable(_proposalId) returns(bool) {
        Proposal storage proposal = proposals[_proposalId];
        Parameters memory params = parameters[proposal.paramsHash];
        address voter;
        if (params.voteOnBehalf != address(0)) {
            require(msg.sender == params.voteOnBehalf);
            voter = _voter;
        } else {
            voter = msg.sender;
        }
        return internalVote(_proposalId, voter, _vote, 0);
    }

  /**
   * @dev voting function with owner functionality (can vote on behalf of someone else)
   * @return bool true - the proposal has been executed
   *              false - otherwise.
   */
    function ownerVote(bytes32 , uint , address ) external returns(bool) {
      //This is not allowed.
        return false;
    }

    function voteWithSpecifiedAmounts(bytes32 _proposalId,uint _vote,uint _rep,uint,address _voter) external votable(_proposalId) returns(bool) {
        Proposal storage proposal = proposals[_proposalId];
        Parameters memory params = parameters[proposal.paramsHash];
        address voter;
        if (params.voteOnBehalf != address(0)) {
            require(msg.sender == params.voteOnBehalf);
            voter = _voter;
        } else {
            voter = msg.sender;
        }
        return internalVote(_proposalId,voter,_vote,_rep);
    }

  /**
   * @dev Cancel the vote of the msg.sender.
   * cancel vote is not allow in genesisProtocol so this function doing nothing.
   * This function is here in order to comply to the IntVoteInterface .
   */
    function cancelVote(bytes32 _proposalId) external votable(_proposalId) {
       //this is not allowed
        return;
    }

  /**
    * @dev getNumberOfChoices returns the number of choices possible in this proposal
    * @return uint that contains number of choices
    */
    function getNumberOfChoices(bytes32) external view returns(uint) {
        return NUM_OF_CHOICES;
    }

    /**
      * @dev getNumberOfChoices returns the number of choices possible in this proposal
      * @param _proposalId id of the proposal
      * @return proposals times array
      */
    function getProposalTimes(bytes32 _proposalId) external view returns(uint[3] times) {
        return proposals[_proposalId].times;
    }

    /**
     * @dev voteInfo returns the vote and the amount of reputation of the user committed to this proposal
     * @param _proposalId the ID of the proposal
     * @param _voter the address of the voter
     * @return uint vote - the voters vote
     *        uint reputation - amount of reputation committed by _voter to _proposalId
     */
    function voteInfo(bytes32 _proposalId, address _voter) external view returns(uint, uint) {
        Voter memory voter = proposals[_proposalId].voters[_voter];
        return (voter.vote, voter.reputation);
    }

    /**
    * @dev voteStatus returns the reputation voted for a proposal for a specific voting choice.
    * @param _proposalId the ID of the proposal
    * @param _choice the index in the
    * @return voted reputation for the given choice
    */
    function voteStatus(bytes32 _proposalId,uint _choice) external view returns(uint) {
        return proposals[_proposalId].votes[_choice];
    }

    /**
    * @dev isVotable check if the proposal is votable
    * @param _proposalId the ID of the proposal
    * @return bool true or false
    */
    function isVotable(bytes32 _proposalId) external view returns(bool) {
        return _isVotable(_proposalId);
    }

    /**
    * @dev proposalStatus return the total votes and stakes for a given proposal
    * @param _proposalId the ID of the proposal
    * @return uint preBoostedVotes YES
    * @return uint preBoostedVotes NO
    * @return uint total stakes YES
    * @return uint total stakes NO
    */
    function proposalStatus(bytes32 _proposalId) external view returns(uint, uint, uint ,uint) {
        return (
                proposals[_proposalId].preBoostedVotes[YES],
                proposals[_proposalId].preBoostedVotes[NO],
                proposals[_proposalId].stakes[YES],
                proposals[_proposalId].stakes[NO]
        );
    }

  /**
    * @dev getProposalOrganization return the organizationId for a given proposal
    * @param _proposalId the ID of the proposal
    * @return bytes32 organization identifier
    */
    function getProposalOrganization(bytes32 _proposalId) external view returns(bytes32) {
        return (proposals[_proposalId].organizationId);
    }

    /**
      * @dev getStaker return the vote and stake amount for a given proposal and staker
      * @param _proposalId the ID of the proposal
      * @param _staker staker address
      * @return uint vote
      * @return uint amount
    */
    function getStaker(bytes32 _proposalId,address _staker) external view returns(uint,uint) {
        return (proposals[_proposalId].stakers[_staker].vote,proposals[_proposalId].stakers[_staker].amount);
    }

    /**
      * @dev voteStake return the amount stakes for a given proposal and vote
      * @param _proposalId the ID of the proposal
      * @param _vote vote number
      * @return uint stake amount
    */
    function voteStake(bytes32 _proposalId,uint _vote) external view returns(uint) {
        return proposals[_proposalId].stakes[_vote];
    }

  /**
    * @dev voteStake return the winningVote for a given proposal
    * @param _proposalId the ID of the proposal
    * @return uint winningVote
    */
    function winningVote(bytes32 _proposalId) external view returns(uint) {
        return proposals[_proposalId].winningVote;
    }

    /**
      * @dev voteStake return the state for a given proposal
      * @param _proposalId the ID of the proposal
      * @return ProposalState proposal state
    */
    function state(bytes32 _proposalId) external view returns(ProposalState) {
        return proposals[_proposalId].state;
    }

   /**
    * @dev isAbstainAllow returns if the voting machine allow abstain (0)
    * @return bool true or false
    */
    function isAbstainAllow() external pure returns(bool) {
        return false;
    }

    /**
     * @dev getAllowedRangeOfChoices returns the allowed range of choices for a voting machine.
     * @return min - minimum number of choices
               max - maximum number of choices
     */
    function getAllowedRangeOfChoices() external pure returns(uint min,uint max) {
        return (NUM_OF_CHOICES,NUM_OF_CHOICES);
    }

    /**
      * @dev execute check if the proposal has been decided, and if so, execute the proposal
      * @param _proposalId the id of the proposal
      * @return bool true - the proposal has been executed
      *              false - otherwise.
     */
    function execute(bytes32 _proposalId) external votable(_proposalId) returns(bool) {
        return _execute(_proposalId);
    }

    /**
      * @dev expired try to execute a boosted proposal if it is expired
      * @param _proposalId the id of the proposal
      * @return uint expirationCallBounty the bounty amount for the expiration call
     */
    function expired(bytes32 _proposalId) external returns(uint expirationCallBounty) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.state == ProposalState.Boosted);
        require(_execute(_proposalId));
        // solium-disable-next-line security/no-block-members
        uint expirationCallBountyPercentage = (1 + now.sub(proposal.currentBoostedVotePeriodLimit).div(15));
        if (expirationCallBountyPercentage > 100) {
            expirationCallBountyPercentage = 100;
        }
        proposal.expirationCallBountyPercentage = expirationCallBountyPercentage;
        expirationCallBounty = expirationCallBountyPercentage.mul(proposal.stakes[YES]).div(100);
        require(stakingToken.transfer(msg.sender, expirationCallBounty));
        emit ExpirationCallBounty(_proposalId,msg.sender,expirationCallBounty);
    }

    /**
     * @dev redeem a reward for a successful stake, vote or proposing.
     * The function use a beneficiary address as a parameter (and not msg.sender) to enable
     * users to redeem on behalf of someone else.
     * @param _proposalId the ID of the proposal
     * @param _beneficiary - the beneficiary address
     * @return rewards -
     *           [0] stakerTokenReward
     *           [1] voterReputationReward
     *           [2] proposerReputationReward
     */
    function redeem(bytes32 _proposalId,address _beneficiary) public returns (uint[3] rewards) {
        Proposal storage proposal = proposals[_proposalId];
        require((proposal.state == ProposalState.Executed) || (proposal.state == ProposalState.Closed),"wrong proposal state");
        Parameters memory params = parameters[proposal.paramsHash];
      //  uint reputation;
        uint lostReputation;
        if (proposal.winningVote == YES) {
            lostReputation = proposal.preBoostedVotes[NO];
        } else {
            lostReputation = proposal.preBoostedVotes[YES];
        }
        lostReputation = (lostReputation * params.votersReputationLossRatio)/100;
        //as staker
        Staker storage staker = proposal.stakers[_beneficiary];
        if (staker.amount > 0) {
            if (proposal.state == ProposalState.Closed) {
                //Stakes of a proposal that expires in Queue are sent back to stakers
                rewards[0] = staker.amount;
          }else if (staker.vote == proposal.winningVote) {
                    uint totalWinningStakes = proposal.stakes[proposal.winningVote];
                    uint totalStakes = proposal.stakes[YES]+proposal.stakes[NO];
                    if (totalWinningStakes != 0) {
                        if (staker.vote == YES) {
                            uint _totalStakes = ((totalStakes*(100 - proposal.expirationCallBountyPercentage))/100) - proposal.daoBounty;
                            rewards[0] = (staker.amount*_totalStakes)/totalWinningStakes;
                        } else {
                            rewards[0] = (staker.amount*totalStakes)/totalWinningStakes;
                        }
                 }
          }
            staker.amount = staker.amount.sub(rewards[0]);
        }
        //as voter
        Voter storage voter = proposal.voters[_beneficiary];
        if ((voter.reputation != 0 ) && (voter.preBoosted)) {
            uint preBoostedVotes = proposal.preBoostedVotes[YES] + proposal.preBoostedVotes[NO];
            if (proposal.state == ProposalState.Closed) {
              //give back reputation for the voter
                rewards[1] = ((voter.reputation * params.votersReputationLossRatio)/100);
            } else if (proposal.winningVote == voter.vote ) {
                rewards[1] = (((voter.reputation * params.votersReputationLossRatio)/100) +
                ((voter.reputation * lostReputation)/preBoostedVotes));
            }
            voter.reputation = 0;
        }
        //as proposer
        if ((proposal.proposer == _beneficiary)&&(proposal.winningVote == YES)&&(proposal.proposer != address(0))) {
            rewards[2] = params.proposingRepRewardConstA;
            proposal.proposer = 0;
        }
        if (rewards[0] != 0) {
            proposal.totalStakes = proposal.totalStakes.sub(rewards[0]);
            require(stakingToken.transfer(_beneficiary, rewards[0]));
            emit Redeem(_proposalId,organizations[proposal.organizationId],_beneficiary,rewards[0]);
        }
        if (rewards[1] + rewards[2] != 0 ) {
            VotingMachineCallbacksInterface(proposal.callbacks).mintReputation(rewards[1] + rewards[2],_beneficiary,_proposalId);
            emit RedeemReputation(_proposalId,organizations[proposal.organizationId],_beneficiary,rewards[1] + rewards[2]);
        }
    }

    /**
     * @dev redeemDaoBounty a reward for a successful stake, vote or proposing.
     * The function use a beneficiary address as a parameter (and not msg.sender) to enable
     * users to redeem on behalf of someone else.
     * @param _proposalId the ID of the proposal
     * @param _beneficiary - the beneficiary address
     * @return redeemedAmount - redeem token amount
     * @return potentialAmount - potential redeem token amount(if there is enough tokens bounty at the organization )
     */
    function redeemDaoBounty(bytes32 _proposalId,address _beneficiary) public returns(uint redeemedAmount,uint potentialAmount) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.state == ProposalState.Executed);
        uint totalWinningStakes = proposal.stakes[proposal.winningVote];
        Staker storage staker = proposal.stakers[_beneficiary];
        if (
          // solium-disable-next-line operator-whitespace
            (staker.vote == proposal.winningVote)&&
            (proposal.winningVote == YES)&&
            (totalWinningStakes != 0))
        {
            //as staker
            potentialAmount = (staker.amount * proposal.daoBounty)/totalWinningStakes;
        }
        if ((potentialAmount != 0)&&
            (VotingMachineCallbacksInterface(proposal.callbacks).balanceOfStakingToken(stakingToken,_proposalId) >= potentialAmount))
        {
            proposal.daoBountyRemain = proposal.daoBountyRemain.sub(potentialAmount);
            require(VotingMachineCallbacksInterface(proposal.callbacks).stakingTokenTransfer(stakingToken,_beneficiary,potentialAmount,_proposalId));
            redeemedAmount = potentialAmount;
            emit RedeemDaoBounty(_proposalId,organizations[proposal.organizationId],_beneficiary,redeemedAmount);
        }
    }

    /**
     * @dev shouldBoost check if a proposal should be shifted to boosted phase.
     * @param _proposalId the ID of the proposal
     * @return bool true or false.
     */
    function shouldBoost(bytes32 _proposalId) public view returns(bool) {
        Proposal memory proposal = proposals[_proposalId];
        return (_score(_proposalId) > threshold(proposal.paramsHash,proposal.organizationId));
    }

    /**
     * @dev score return the proposal score
     * @param _proposalId the ID of the proposal
     * @return uint proposal score.
     */
    function score(bytes32 _proposalId) public view returns(int) {
        return  _score(_proposalId);
    }

    /**
     * @dev threshold return the organization's score threshold which required by
     * a proposal to shift to boosted state.
     * This threshold is dynamically set and it depend on the number of boosted proposal.
     * @param _organizationId the organization identifier
     * @param _paramsHash the organization parameters hash
     * @return int organization's score threshold.
     */
    function threshold(bytes32 _paramsHash,bytes32 _organizationId) public view returns(int) {
        return int216(parameters[_paramsHash].thresholdConstA).toReal().pow(int216(orgBoostedProposalsCnt[_organizationId]).toReal()).fromReal();
    }

    /**
     * @dev hash the parameters, save them if necessary, and return the hash value
     * @param _params a parameters array
     *    _params[0] - _quedVoteRequiredPercentage,
     *    _params[1] - _quedVotePeriodLimit, //the time limit for a proposal to be in an absolute voting mode.
     *    _params[2] - _boostedVotePeriodLimit, //the time limit for a proposal to be in an relative voting mode.
     *    _params[3] - _preBoostedVotePeriodLimit, //the time limit for a proposal to be in an preparation state (stable) before boosted.
     *    _params[4] -_thresholdConstA
     *    _params[5] -_quietEndingPeriod
     *    _params[6] -_proposingRepRewardConstA
     *    _params[7] -_votersReputationLossRatio
     *    _params[8] -_minimumDaoBounty
     *    _params[9] -_daoBountyConst
     * @param _voteOnBehalf - authorized to vote on behalf of others.
    */
    function setParameters(
        uint[10] _params, //use array here due to stack too deep issue.
        address _voteOnBehalf
    )
    public
    returns(bytes32)
    {
        require(_params[0] <= 100 && _params[0] >= 50,"50 <= quedVoteRequiredPercentage <= 100");
        require(_params[4] <= 100000000 ether && _params[4] > 1 ether,"1 < thresholdConstA <= 100000000 wei");
        require(_params[7] <= 100,"votersReputationLossRatio <= 100");
        require(_params[2] >= _params[5],"boostedVotePeriodLimit >= quietEndingPeriod");
        require(_params[8] > 0,"minimumDaoBounty should be > 0");
        require(_params[9] > 0,"daoBountyConst should be > 0");

        bytes32 paramsHash = getParametersHash(_params, _voteOnBehalf);


        parameters[paramsHash] = Parameters({
            quedVoteRequiredPercentage: _params[0],
            quedVotePeriodLimit: _params[1],
            boostedVotePeriodLimit: _params[2],
            preBoostedVotePeriodLimit: _params[3],
            thresholdConstA:_params[4],
            quietEndingPeriod: _params[5],
            proposingRepRewardConstA: _params[6],
            votersReputationLossRatio:_params[7],
            minimumDaoBounty:_params[8],
            daoBountyConst:_params[9],
            voteOnBehalf:_voteOnBehalf
        });
        return paramsHash;
    }

  /**
   * @dev hashParameters returns a hash of the given parameters
   */
    function getParametersHash(
        uint[10] _params,//use array here due to stack too deep issue.
        address _voteOnBehalf
    )
        public
        pure
        returns(bytes32)
        {
        //double call to keccak256 to avoid deep stack issue when call with too many params.
        return keccak256(
            abi.encodePacked(
             keccak256(
              abi.encodePacked(
                _params[0],
                _params[1],
                _params[2],
                _params[3],
                _params[4],
                _params[5],
                _params[6],
                _params[7],
                _params[8],
                _params[9]
             )),
            _voteOnBehalf
        ));
    }

    /**
      * @dev execute check if the proposal has been decided, and if so, execute the proposal
      * @param _proposalId the id of the proposal
      * @return bool true - the proposal has been executed
      *              false - otherwise.
     */
    function _execute(bytes32 _proposalId) internal votable(_proposalId) returns(bool) {
        Proposal storage proposal = proposals[_proposalId];
        Parameters memory params = parameters[proposal.paramsHash];
        Proposal memory tmpProposal = proposal;
        uint totalReputation = VotingMachineCallbacksInterface(proposal.callbacks).getTotalReputationSupply(_proposalId);
        uint executionBar = totalReputation * params.quedVoteRequiredPercentage/100;
        ExecutionState executionState = ExecutionState.None;
        uint averageBoostDownstakes;

        if (proposal.votes[proposal.winningVote] > executionBar) {
         // someone crossed the absolute vote execution bar.
            if (proposal.state == ProposalState.Qued) {
                executionState = ExecutionState.QueBarCrossed;
            } else if (proposal.state == ProposalState.PreBoosted) {
                executionState = ExecutionState.PreBoostedBarCrossed;
            } else {
                executionState = ExecutionState.BoostedBarCrossed;
            }
            proposal.state = ProposalState.Executed;
         } else {
            if (proposal.state == ProposalState.Qued) {
                // solium-disable-next-line security/no-block-members
                if ((now - proposal.times[0]) >= params.quedVotePeriodLimit) {
                    proposal.state = ProposalState.Closed;
                    proposal.winningVote = NO;
                    executionState = ExecutionState.QueTimeOut;
                 } else if ( shouldBoost(_proposalId)) {
                    //change proposal mode to PreBoosted mode.
                    proposal.state = ProposalState.PreBoosted;
                    // solium-disable-next-line security/no-block-members
                    proposal.times[2] = now;
                    proposal.threshold = threshold(proposal.paramsHash,proposal.organizationId);
                  }
               }

            if (proposal.state == ProposalState.PreBoosted) {
              // solium-disable-next-line security/no-block-members
                if ((now - proposal.times[2]) >= params.preBoostedVotePeriodLimit) {
                    if (shouldBoost(_proposalId)) {
                     //change proposal mode to Boosted mode.
                        proposal.state = ProposalState.Boosted;
                       // solium-disable-next-line security/no-block-members
                        proposal.times[1] = now;
                        orgBoostedProposalsCnt[proposal.organizationId]++;
                       //add a value to average -> average = average + ((value - average) / nbValues)
                        averageBoostDownstakes = averagesBoostDownstakes[proposal.organizationId];
                        averagesBoostDownstakes[proposal.organizationId] = uint256(int256(averageBoostDownstakes) + ((int216(proposal.stakes[NO])-int216(averageBoostDownstakes)).toReal().div(int216(orgBoostedProposalsCnt[proposal.organizationId]).toReal())).fromReal());
                 }
               } else { //check the Confidence level is stable
                    if (_score(_proposalId) <= proposal.threshold) {
                        proposal.state = ProposalState.Qued;
                    }
               }
            }
        }

        if ((proposal.state == ProposalState.Boosted) ||
            (proposal.state == ProposalState.QuietEndingPeriod)) {
            // solium-disable-next-line security/no-block-members
            if ((now - proposal.times[1]) >= proposal.currentBoostedVotePeriodLimit) {
                proposal.state = ProposalState.Executed;
                executionState = ExecutionState.BoostedTimeOut;
            }
          }

        if (executionState != ExecutionState.None) {
            if ((executionState == ExecutionState.BoostedTimeOut) || (executionState == ExecutionState.BoostedBarCrossed)) {
                orgBoostedProposalsCnt[tmpProposal.organizationId] = orgBoostedProposalsCnt[tmpProposal.organizationId].sub(1);
                //remove a value from average = ((average * nbValues) - value) / (nbValues - 1);
                uint boostedProposals = orgBoostedProposalsCnt[tmpProposal.organizationId];
                if (boostedProposals == 0) {
                    averagesBoostDownstakes[proposal.organizationId] = 0;
                } else {
                    averageBoostDownstakes = averagesBoostDownstakes[proposal.organizationId];
                    averagesBoostDownstakes[proposal.organizationId] = uint256(int216(averageBoostDownstakes.mul(boostedProposals+1).sub(proposal.stakes[NO])).toReal().div(int216(boostedProposals).toReal()).fromReal());
                }
            }
            emit ExecuteProposal(_proposalId, organizations[proposal.organizationId], proposal.winningVote, totalReputation);
            emit GPExecuteProposal(_proposalId, executionState);
            ProposalExecuteInterface(proposal.callbacks).executeProposal(_proposalId,int(proposal.winningVote));
            proposal.daoBounty = proposal.daoBountyRemain;
        }
        return (executionState != ExecutionState.None);
    }

    /**
     * @dev staking function
     * @param _proposalId id of the proposal
     * @param _vote  NO(2) or YES(1).
     * @param _amount the betting amount
     * @return bool true - the proposal has been executed
     *              false - otherwise.
     */
    function _stake(bytes32 _proposalId, uint _vote, uint _amount,address _staker) internal returns(bool) {
        // 0 is not a valid vote.
        require(_vote <= NUM_OF_CHOICES && _vote > 0);
        require(_amount > 0);
        if (_execute(_proposalId)) {
            return true;
        }

        Proposal storage proposal = proposals[_proposalId];

        if ((proposal.state != ProposalState.PreBoosted) &&
           (proposal.state != ProposalState.Qued))
        {
            return false;
        }

        // enable to increase stake only on the previous stake vote
        Staker storage staker = proposal.stakers[_staker];
        if ((staker.amount > 0) && (staker.vote != _vote)) {
            return false;
        }

        uint amount = _amount;
        require(stakingToken.transferFrom(_staker, address(this), amount));
        proposal.totalStakes = proposal.totalStakes.add(amount); //update totalRedeemableStakes
        staker.amount += amount;
      //  staker.amountForBounty = staker.amount;
        staker.vote = _vote;

        proposal.stakes[_vote] = amount.add(proposal.stakes[_vote]);
      // Event:
        emit Stake(_proposalId, organizations[proposal.organizationId], _staker, _vote, _amount);
      // execute the proposal if this vote was decisive:
        return _execute(_proposalId);
    }

    /**
     * @dev Vote for a proposal, if the voter already voted, cancel the last vote and set a new one instead
     * @param _proposalId id of the proposal
     * @param _voter used in case the vote is cast for someone else
     * @param _vote a value between 0 to and the proposal's number of choices.
     * @param _rep how many reputation the voter would like to stake for this vote.
     *         if  _rep==0 so the voter full reputation will be use.
     * @return true in case of proposal execution otherwise false
     * throws if proposal is not open or if it has been executed
     * NB: executes the proposal if a decision has been reached
     */
    function internalVote(bytes32 _proposalId, address _voter, uint _vote, uint _rep) private returns(bool) {
        // 0 is not a valid vote.
        require(_vote <= NUM_OF_CHOICES && _vote > 0,"0 < _vote <= 2");
        if (_execute(_proposalId)) {
            return true;
        }

        Parameters memory params = parameters[proposals[_proposalId].paramsHash];
        Proposal storage proposal = proposals[_proposalId];

        // Check voter has enough reputation:
        uint reputation = VotingMachineCallbacksInterface(proposal.callbacks).reputationOf(_voter,_proposalId);
        require(reputation >= _rep,"reputation >= _rep");
        uint rep = _rep;
        if (rep == 0) {
            rep = reputation;
        }
        // If this voter has already voted, return false.
        if (proposal.voters[_voter].reputation != 0) {
            return false;
        }
        // The voting itself:
        proposal.votes[_vote] = rep.add(proposal.votes[_vote]);
        //check if the current winningVote changed or there is a tie.
                //for the case there is a tie the current winningVote set to NO.
        if ((proposal.votes[_vote] > proposal.votes[proposal.winningVote]) ||
           ((proposal.votes[NO] == proposal.votes[proposal.winningVote]) &&
             proposal.winningVote == YES))
        {
            // solium-disable-next-line security/no-block-members
            uint _now = now;
            if ((proposal.state == ProposalState.QuietEndingPeriod) ||
               ((proposal.state == ProposalState.Boosted) && ((_now - proposal.times[1]) >= (params.boostedVotePeriodLimit - params.quietEndingPeriod)))) {
                //quietEndingPeriod
                if (proposal.state != ProposalState.QuietEndingPeriod) {
                    proposal.currentBoostedVotePeriodLimit = params.quietEndingPeriod;
                    proposal.state = ProposalState.QuietEndingPeriod;
                }
                proposal.times[1] = _now;
            }
            proposal.winningVote = _vote;
        }
        proposal.voters[_voter] = Voter({
            reputation: rep,
            vote: _vote,
            preBoosted:((proposal.state == ProposalState.PreBoosted) || (proposal.state == ProposalState.Qued))
        });
        if ((proposal.state == ProposalState.PreBoosted) || (proposal.state == ProposalState.Qued)) {
            proposal.preBoostedVotes[_vote] = rep.add(proposal.preBoostedVotes[_vote]);
            uint reputationDeposit = (params.votersReputationLossRatio * rep)/100;
            VotingMachineCallbacksInterface(proposal.callbacks).burnReputation(reputationDeposit,_voter,_proposalId);
        }
        // Event:
        emit VoteProposal(_proposalId, organizations[proposal.organizationId], _voter, _vote, rep);
        // execute the proposal if this vote was decisive:
        return _execute(_proposalId);
    }

    /**
     * @dev _score return the proposal score (Confidence level)
     * For dual choice proposal S = (S+)/(S-)
     * @param _proposalId the ID of the proposal
     * @return int proposal score.
     */
    function _score(bytes32 _proposalId) private view returns(int) {
        Proposal storage proposal = proposals[_proposalId];
        return (int216(proposal.stakes[YES]).toReal().div(int216(proposal.stakes[NO]).toReal())).fromReal();
    }

    /**
      * @dev _isVotable check if the proposal is votable
      * @param _proposalId the ID of the proposal
      * @return bool true or false
    */
    function _isVotable(bytes32 _proposalId) private view returns(bool) {
        ProposalState pState = proposals[_proposalId].state;
        // solium-disable-next-line operator-whitespace
        return ((pState == ProposalState.PreBoosted)||
                (pState == ProposalState.Boosted)||
                (pState == ProposalState.QuietEndingPeriod)||
                (pState == ProposalState.Qued)
        );
    }

    /**
      * @dev isContract check if a given address is a contract address
      * @param _addr the address to check.
      * @return bool true or false
    */
    function isContract(address _addr) private view returns (bool) {
        uint32 size;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
          size := extcodesize(_addr)
        }
        return (size > 0);
    }

}
