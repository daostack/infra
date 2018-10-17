pragma solidity ^0.4.25;

import "../votingMachines/ProposalExecuteInterface.sol";
import "../votingMachines/VotingMachineCallbacksInterface.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Debug.sol";
import "../Reputation.sol";
import "../votingMachines/AbsoluteVote.sol";


contract AbsoluteVoteExecuteMock is Debug,VotingMachineCallbacksInterface,ProposalExecuteInterface,Ownable {

    Reputation public reputation;
    AbsoluteVote public absoluteVote;
    mapping (bytes32=>uint) proposalsBlockNumbers;


    event NewProposal(bytes32 indexed _proposalId, address indexed _organization, uint _numOfChoices, address _proposer, bytes32 _paramsHash);

    /**
     * @dev Constructor
     */
    constructor(Reputation _reputation,AbsoluteVote _absoluteVote) public
    {
        reputation = _reputation;
        absoluteVote = _absoluteVote;
        transferOwnership(address(_absoluteVote));
    }

    function getTotalSupply(bytes32 _proposalId) external view returns(uint256) {
        return reputation.totalSupplyAt(proposalsBlockNumbers[_proposalId]);
    }

    function balanceOf(address _owner,bytes32 _proposalId) external view returns(uint) {
        return reputation.balanceOfAt(_owner,proposalsBlockNumbers[_proposalId]);
    }

    function executeProposal(bytes32 _proposalId,int _decision) external returns(bool) {
        emit LogBytes32(_proposalId);
        emit LogInt(_decision);
        return true;
    }

    function ownerVote(bytes32 _proposalId,uint _vote, address _voter) external returns(bool) {
        return absoluteVote.ownerVote(_proposalId,_vote,_voter);
    }

    function cancelProposal(bytes32 _proposalId) external returns(bool) {
        return absoluteVote.cancelProposal(_proposalId);
    }

    function propose(uint _numOfChoices, bytes32 _paramsHash, address ,address _proposer,address _organization)
    external
    returns
    (bytes32)
    {
        bytes32 proposalId = absoluteVote.propose(_numOfChoices,_paramsHash,_proposer,_organization);
        proposalsBlockNumbers[proposalId] = block.number;

        return proposalId;
    }

    //this function is used only for testing purpose on this mock contract
    function burnReputationTest(uint _amount,address _beneficiary,bytes32)
    external
    returns(bool)
    {
        return reputation.burn(_beneficiary,_amount);
    }

    function setProposal(bytes32 _proposalId) external returns(bool) {
        proposalsBlockNumbers[_proposalId] = block.number;
    }

}
