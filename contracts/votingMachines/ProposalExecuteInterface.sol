// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.10;

interface ProposalExecuteInterface {
    function executeProposal(bytes32 _proposalId, int _decision) external returns(bool);
}
