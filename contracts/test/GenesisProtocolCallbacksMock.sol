pragma solidity ^0.4.24;

import "../VotingMachines/GenesisProtocolCallbacksInterface.sol";
import "../VotingMachines/GenesisProtocol.sol";
import "../Reputation.sol";


contract GenesisProtocolCallbacksMock is GenesisProtocolCallbacksInterface {

    Reputation public reputation;
    StandardToken public stakingToken;
    GenesisProtocol genesisProtocol;
    mapping (bytes32=>uint) proposalsBlockNumbers;

    event NewProposal(bytes32 indexed _proposalId, address indexed _organization, uint _numOfChoices, address _proposer, bytes32 _paramsHash);


    /**
     * @dev Constructor
     */
    constructor(Reputation _reputation,StandardToken _stakingToken,GenesisProtocol _genesisProtocol) public
    {
        reputation = _reputation;
        stakingToken = _stakingToken;
        genesisProtocol = _genesisProtocol;
    }

    function getTotalReputationSupply(bytes32 _proposalId) external returns(uint256) {
        return reputation.totalSupplyAt(proposalsBlockNumbers[_proposalId]);
    }

    function mintReputation(uint _amount,address _beneficiary,bytes32) external returns(bool) {
        return reputation.mint(_beneficiary,_amount);
    }

    function burnReputation(uint _amount,address _beneficiary,bytes32) external returns(bool) {
        return reputation.burn(_beneficiary,_amount);
    }

    function reputationOf(address _owner,bytes32 _proposalId) external returns(uint) {
        return reputation.balanceOfAt(_owner,proposalsBlockNumbers[_proposalId]);
    }

    function stakingTokenTransfer(address _beneficiary,uint _amount,bytes32) external returns(bool) {
        return stakingToken.transfer(_beneficiary,_amount);
    }

    function setParameters(uint[14] _params,address _voteOnBehalf) external returns(bytes32) {
        return genesisProtocol.setParameters(_params,_voteOnBehalf);
    }

    function executeProposal(bytes32 _proposalId,int _decision,ExecutableInterface _executable) external returns(bool) {
        return  _executable.execute(_proposalId, 0, _decision);
    }

    function propose(uint _numOfChoices, bytes32 _paramsHash, address , ExecutableInterface _executable,address _proposer)
    external
    returns
    (bytes32)
    {
        bytes32 proposalId = genesisProtocol.propose(_numOfChoices,_paramsHash,0,_executable,_proposer);
        proposalsBlockNumbers[proposalId] = block.number;
        emit NewProposal(proposalId, this, _numOfChoices, msg.sender, _paramsHash);

        return proposalId;
    }

}
