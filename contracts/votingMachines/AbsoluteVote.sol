pragma solidity ^0.4.25;

import "./IntVoteInterface.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./VotingMachineCallbacksInterface.sol";
import "./ProposalExecuteInterface.sol";


contract AbsoluteVote is IntVoteInterface {
    using SafeMath for uint;


    struct Parameters {
        uint precReq; // how many percentages required for the proposal to be passed
        bool allowOwner; // does this proposal has an owner who has owner rights?
    }

    struct Voter {
        uint vote; // 0 - 'abstain'
        uint balance; // voter's balance
    }

    struct Proposal {
        address owner; // the proposal's owner
        bytes32 organizationId; // the organization Id
        address callbacks;
        uint numOfChoices;
        bytes32 paramsHash; // the hash of the parameters of the proposal
        uint totalVotes;
        mapping(uint=>uint) votes;
        mapping(address=>Voter) voters;
        bool open; // voting open flag
    }

    event AVVoteProposal(bytes32 indexed _proposalId, bool _isOwnerVote);
    event RefreshBalance(bytes32 indexed _proposalId, bytes32 indexed _organizationId, address indexed _voter,uint _balance);


    mapping(bytes32=>Parameters) public parameters;  // A mapping from hashes to parameters
    mapping(bytes32=>Proposal) public proposals; // Mapping from the ID of the proposal to the proposal itself.
    mapping(bytes32        => address     ) organizations;

    uint public constant MAX_NUM_OF_CHOICES = 10;
    uint public proposalsCnt; // Total amount of proposals

  /**
   * @dev Check that there is owner for the proposal and he sent the transaction
   */
    modifier onlyProposalOwner(bytes32 _proposalId) {
        require(msg.sender == proposals[_proposalId].owner);
        _;
    }

  /**
   * @dev Check that the proposal is votable (open and not executed yet)
   */
    modifier votable(bytes32 _proposalId) {
        require(proposals[_proposalId].open);
        _;
    }

    /**
     * @dev register a new proposal with the given parameters. Every proposal has a unique ID which is being
     * generated by calculating keccak256 of a incremented counter.
     * @param _numOfChoices number of voting choices
     * @param _paramsHash defined the parameters of the voting machine used for this proposal
     * @param _organization address
     * @return proposal's id.
     */
    function propose(uint _numOfChoices, bytes32 _paramsHash, address, address _organization)
        external
        returns(bytes32)
    {
        // Check valid params and number of choices:
        require(parameters[_paramsHash].precReq > 0);
        require(_numOfChoices > 0 && _numOfChoices <= MAX_NUM_OF_CHOICES);
        // Generate a unique ID:
        bytes32 proposalId = keccak256(abi.encodePacked(this, proposalsCnt));
        proposalsCnt++;
        // Open proposal:
        Proposal memory proposal;
        proposal.numOfChoices = _numOfChoices;
        proposal.paramsHash = _paramsHash;
        proposal.callbacks = msg.sender;
        proposal.organizationId = keccak256(abi.encodePacked(msg.sender,_organization));
        proposal.owner = msg.sender;
        proposal.open = true;
        proposals[proposalId] = proposal;
        if (organizations[proposal.organizationId] == 0) {
            if (_organization == address(0)) {
                organizations[proposal.organizationId] = msg.sender;
            } else {
                organizations[proposal.organizationId] = _organization;
            }
        }
        emit NewProposal(proposalId, organizations[proposal.organizationId], _numOfChoices, msg.sender, _paramsHash);
        return proposalId;
    }

  /**
   * @dev Cancel a proposal, only the owner can call this function and only if allowOwner flag is true.
   * @param _proposalId the proposal ID
   */
    function cancelProposal(bytes32 _proposalId) external onlyProposalOwner(_proposalId) votable(_proposalId) returns(bool) {
        if (! parameters[proposals[_proposalId].paramsHash].allowOwner) {
            return false;
        }
        bytes32 organizationId = proposals[_proposalId].organizationId;
        deleteProposal(_proposalId);
        emit CancelProposal(_proposalId, organizations[organizationId]);
        return true;
    }

  /**
   * @dev voting function
   * @param _proposalId id of the proposal
   * @param _vote a value between 0 to and the proposal number of choices.
   * @return bool true - the proposal has been executed
   *              false - otherwise.
   */
    function vote(bytes32 _proposalId, uint _vote,address) external votable(_proposalId) returns(bool) {
        return internalVote(_proposalId, msg.sender, _vote, 0);
    }

  /**
   * @dev voting function with owner functionality (can vote on behalf of someone else)
   * @param _proposalId id of the proposal
   * @param _vote a value between 0 to and the proposal number of choices.
   * @param _voter will be voted with that voter's address
   * @return bool true - the proposal has been executed
   *              false - otherwise.
   */
    function ownerVote(bytes32 _proposalId, uint _vote, address _voter)
        external
        onlyProposalOwner(_proposalId)
        votable(_proposalId)
        returns(bool)
    {
        if (! parameters[proposals[_proposalId].paramsHash].allowOwner) {
            return false;
        }
        return  internalVote(_proposalId, _voter, _vote, 0);
    }

    function voteWithSpecifiedAmounts(bytes32 _proposalId,uint _vote,uint _voteAmount,address) external votable(_proposalId) returns(bool) {
        return internalVote(_proposalId,msg.sender,_vote,_voteAmount);
    }

  /**
   * @dev Cancel the vote of the msg.sender: subtract the voter balance from the votes
   * and delete the voter from the proposal struct
   * @param _proposalId id of the proposal
   */
    function cancelVote(bytes32 _proposalId) external votable(_proposalId) {
        cancelVoteInternal(_proposalId, msg.sender);
    }

  /**
   * @dev getNumberOfChoices returns the number of choices possible in this proposal
   * @param _proposalId the ID of the proposal
   * @return uint that contains number of choices
   */
    function getNumberOfChoices(bytes32 _proposalId) external view returns(uint) {
        return proposals[_proposalId].numOfChoices;
    }

  /**
   * @dev voteInfo returns the vote and the voter balance of the user committed to this proposal
   * @param _proposalId the ID of the proposal
   * @param _voter the address of the voter
   * @return uint vote - the voters vote
   *        uint balance - voter balance committed by _voter to _proposalId
   */
    function voteInfo(bytes32 _proposalId, address _voter) external view returns(uint, uint) {
        Voter memory voter = proposals[_proposalId].voters[_voter];
        return (voter.vote, voter.balance);
    }

    /**
     * @dev voteStatus returns the amount voted for a proposal for a specific voting choice.
     * @param _proposalId the ID of the proposal
     * @param _choice the index in the
     * @return amount voted for the given choice
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
        return  proposals[_proposalId].open;
    }

    /**
     * @dev isAbstainAllow returns if the voting machine allow abstain (0)
     * @return bool true or false
     */
    function isAbstainAllow() external pure returns(bool) {
        return true;
    }

    /**
     * @dev getAllowedRangeOfChoices returns the allowed range of choices for a voting machine.
     * @return min - minimum number of choices
               max - maximum number of choices
     */
    function getAllowedRangeOfChoices() external pure returns(uint min,uint max) {
        return (1,MAX_NUM_OF_CHOICES);
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
     * @dev hash the parameters, save them if necessary, and return the hash value
    */
    function setParameters(uint _precReq, bool _allowOwner) public returns(bytes32) {
        require(_precReq <= 100 && _precReq > 0);
        bytes32 hashedParameters = getParametersHash(_precReq, _allowOwner);
        parameters[hashedParameters] = Parameters({
            precReq: _precReq,
            allowOwner: _allowOwner
        });
        return hashedParameters;
    }

    /**
     * @dev hashParameters returns a hash of the given parameters
     */
    function getParametersHash(uint _precReq, bool _allowOwner) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(_precReq, _allowOwner));
    }

    function cancelVoteInternal(bytes32 _proposalId, address _voter) internal {
        Proposal storage proposal = proposals[_proposalId];
        Voter memory voter = proposal.voters[_voter];
        proposal.votes[voter.vote] = (proposal.votes[voter.vote]).sub(voter.balance);
        proposal.totalVotes = (proposal.totalVotes).sub(voter.balance);
        delete proposal.voters[_voter];
        emit CancelVoting(_proposalId, organizations[proposal.organizationId], _voter);
    }

    function deleteProposal(bytes32 _proposalId) internal {
        Proposal storage proposal = proposals[_proposalId];
        for (uint cnt = 0; cnt <= proposal.numOfChoices; cnt++) {
            delete proposal.votes[cnt];
        }
        delete proposals[_proposalId];
    }

    /**
      * @dev execute check if the proposal has been decided, and if so, execute the proposal
      * @param _proposalId the id of the proposal
      * @return bool true - the proposal has been executed
      *              false - otherwise.
     */
    function _execute(bytes32 _proposalId) internal votable(_proposalId) returns(bool) {
        Proposal storage proposal = proposals[_proposalId];
        uint totalSupply = VotingMachineCallbacksInterface(proposal.callbacks).getTotalSupply(_proposalId);
        uint precReq = parameters[proposal.paramsHash].precReq;
        // Check if someone crossed the bar:
        for (uint cnt = 0; cnt <= proposal.numOfChoices; cnt++) {
            if (proposal.votes[cnt] > totalSupply*precReq/100) {
                Proposal memory tmpProposal = proposal;
                deleteProposal(_proposalId);
                emit ExecuteProposal(_proposalId, organizations[tmpProposal.organizationId], cnt, totalSupply);
                ProposalExecuteInterface(tmpProposal.callbacks).executeProposal(_proposalId,int(cnt));
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Vote for a proposal, if the voter already voted, cancel the last vote and set a new one instead
     * @param _proposalId id of the proposal
     * @param _voter used in case the vote is cast for someone else
     * @param _vote a value between 0 to and the proposal's number of choices.
     * @return true in case of proposal execution otherwise false
     * throws if proposal is not open or if it has been executed
     * NB: executes the proposal if a decision has been reached
     */
    function internalVote(bytes32 _proposalId, address _voter, uint _vote, uint _voteAmount) private returns(bool) {
        Proposal storage proposal = proposals[_proposalId];
        // Check valid vote:
        require(_vote <= proposal.numOfChoices);
        // Check voter has enough amount in its balance:
        uint balance = VotingMachineCallbacksInterface(proposal.callbacks).balanceOf(_voter,_proposalId);
        require(balance >= _voteAmount);
        uint voteAmount = _voteAmount;
        if (_voteAmount == 0) {
            voteAmount = balance;
        }
        // If this voter has already voted, first cancel the vote:
        if (proposal.voters[_voter].balance != 0) {
            cancelVoteInternal(_proposalId, _voter);
        }
        // The voting itself:
        proposal.votes[_vote] = proposal.votes[_vote].add(voteAmount);
        proposal.totalVotes = proposal.totalVotes.add(voteAmount);
        proposal.voters[_voter] = Voter({
            balance: voteAmount,
            vote: _vote
        });
        // Event:
        emit VoteProposal(_proposalId, organizations[proposal.organizationId], _voter, _vote, voteAmount);
        emit AVVoteProposal(_proposalId, (_voter != msg.sender));
        // execute the proposal if this vote was decisive:
        return _execute(_proposalId);
    }
}
