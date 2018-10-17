pragma solidity ^0.4.25;

interface VotingMachineCallbacksInterface {
    function getTotalSupply(bytes32 _proposalId) external view returns(uint256);
    function balanceOf(address _owner, bytes32 _proposalId) external view returns(uint);
}
