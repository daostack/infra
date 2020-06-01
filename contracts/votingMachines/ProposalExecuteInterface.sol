pragma solidity ^0.6.8;

interface ProposalExecuteInterface {
    function executeProposal(bytes32 _proposalId, int _decision) external returns(bool);
}
