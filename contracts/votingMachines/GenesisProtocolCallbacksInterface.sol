pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "./VotingMachineCallbacksInterface.sol";


contract GenesisProtocolCallbacksInterface is VotingMachineCallbacksInterface {
    function mintReputation(uint _amount,address _beneficiary,bytes32 _proposalId) external returns(bool);
    function burnReputation(uint _amount,address _owner,bytes32 _proposalId) external returns(bool);
    function stakingTokenTransfer(StandardToken _stakingToken,address _beneficiary,uint _amount,bytes32 _proposalId) external returns(bool);
    function balanceOfStakingToken(StandardToken _stakingToken,bytes32 _proposalId) external view returns(uint);
}
