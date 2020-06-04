pragma solidity ^0.5.17;

import "../votingMachines/GenesisProtocol.sol";
import "../votingMachines/VotingMachineCallbacksInterface.sol";
import "../votingMachines/ProposalExecuteInterface.sol";
import "../Reputation.sol";
import "./Debug.sol";


contract VotableSchemeMock is Debug, VotingMachineCallbacksInterface, ProposalExecuteInterface, GenesisProtocol {

    Reputation public reputation;
    IERC20 public stakingToken;
    mapping (bytes32=>uint) public proposalsBlockNumbers;

    event NewProposal(
        bytes32 indexed _proposalId,
        address indexed _organization,
        uint256 _numOfChoices,
        address _proposer
    );

    /**
    * @dev initialize
    */
    function initialize(
        Reputation _reputation,
        IERC20 _stakingToken,
        uint[11] calldata _params,
        address _voteOnBehalf,
        address _authorizedToPropose
    )
    external {
        GenesisProtocolLogic.initialize(
            _stakingToken,
            _params,
            _voteOnBehalf,
            address(this),
            address(this),
            _authorizedToPropose
        );
        reputation = _reputation;
        stakingToken = _stakingToken;
    }

    function mintReputation(uint256 _amount, address _beneficiary, bytes32)
    public
    returns(bool)
    {
        require(msg.sender == address(this), "Only the scheme can call this method");
        return reputation.mint(_beneficiary, _amount);
    }

    function burnReputation(uint256 _amount, address _beneficiary, bytes32)
    public
    returns(bool)
    {
        require(msg.sender == address(this), "Only the scheme can call this method");
        return reputation.burn(_beneficiary, _amount);
    }

    function stakingTokenTransfer(IERC20 _stakingToken, address _beneficiary, uint256 _amount, bytes32)
    public
    returns(bool)
    {
        require(msg.sender == address(this), "Only the scheme can call this method");
        return _stakingToken.transfer(_beneficiary, _amount);
    }

    function executeProposal(bytes32 _proposalId, int _decision) external returns(bool) {
        emit LogBytes32(_proposalId);
        emit LogInt(_decision);
        return true;
    }

    function proposeTest(uint256 _numOfChoices, address _proposer)
    external
    returns
    (bytes32)
    {
        bytes32 proposalId = GenesisProtocolLogic.propose(_numOfChoices, _proposer);
        emit NewProposal(proposalId, address(this), _numOfChoices, _proposer);
        proposalsBlockNumbers[proposalId] = block.number;

        return proposalId;
    }

    //this function is used only for testing purpose on this mock contract
    function burnReputationTest(uint256 _amount, address _beneficiary, bytes32)
    external
    returns(bool)
    {
        return reputation.burn(_beneficiary, _amount);
    }

    function setProposal(bytes32 _proposalId) external returns(bool) {
        proposalsBlockNumbers[_proposalId] = block.number;
    }

    function getTotalReputationSupply(bytes32 _proposalId) public view returns(uint256) {
        return reputation.totalSupplyAt(proposalsBlockNumbers[_proposalId]);
    }

    function balanceOfStakingToken(IERC20 _stakingToken, bytes32)
    public
    view
    returns(uint256)
    {
        return _stakingToken.balanceOf(address(this));
    }

    function reputationOf(address _owner, bytes32 _proposalId) public view returns(uint256) {
        return reputation.balanceOfAt(_owner, proposalsBlockNumbers[_proposalId]);
    }

}
