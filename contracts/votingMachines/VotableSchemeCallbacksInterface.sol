pragma solidity ^0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

contract VotableSchemeCallbacksInterface {
    function mintReputation(uint256 _amount, address _beneficiary, bytes32 _proposalId) internal returns(bool);
    function burnReputation(uint256 _amount, address _owner, bytes32 _proposalId) internal returns(bool);

    function stakingTokenTransfer(IERC20 _stakingToken, address _beneficiary, uint256 _amount, bytes32 _proposalId)
    internal
    returns(bool);

    function getTotalReputationSupply(bytes32 _proposalId) internal view returns(uint256);
    function reputationOf(address _owner, bytes32 _proposalId) internal view returns(uint256);
    function balanceOfStakingToken(IERC20 _stakingToken, bytes32 _proposalId) internal view returns(uint256);
}
