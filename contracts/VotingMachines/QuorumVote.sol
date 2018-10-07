pragma solidity ^0.4.25;

import "./AbsoluteVote.sol";
import "./ProposalExecuteInterface.sol";


contract QuorumVote is AbsoluteVote {
    /**
    * @dev check if the proposal has been decided, and if so, execute the proposal
    * @param _proposalId the id of the proposal
    */
    function execute(bytes32 _proposalId) external votable(_proposalId) returns(bool) {
        return _execute(_proposalId);
    }

    /**
    * @dev check if the proposal has been decided, and if so, execute the proposal
    * @param _proposalId the id of the proposal
    */
    function _execute(bytes32 _proposalId) internal votable(_proposalId) returns(bool) {
        Proposal storage proposal = proposals[_proposalId];
        uint totalReputation = VotingMachineCallbacksInterface(proposal.callbacks).getTotalReputationSupply(_proposalId);
        uint precReq = parameters[proposal.paramsHash].precReq;

        // this is the actual voting rule:
        if (proposal.totalVotes > totalReputation*precReq/100) {
            uint max;
            uint maxInd;
            for (uint cnt = 1; cnt<=proposal.numOfChoices; cnt++) {
                if (proposal.votes[cnt] > max) {
                    max = proposal.votes[cnt];
                    maxInd = cnt;
                }
            }
            Proposal memory tmpProposal = proposal;
            deleteProposal(_proposalId);
            emit ExecuteProposal(_proposalId, tmpProposal.organizationId, maxInd, totalReputation);
            ProposalExecuteInterface(tmpProposal.callbacks).executeProposal(_proposalId,int(maxInd));
            return true;
        }
        return false;
    }
}
