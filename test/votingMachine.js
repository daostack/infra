const helpers = require('./helpers');
const constants = require('./constants');
const AbsoluteVote = artifacts.require('AbsoluteVote');
const QuorumVote = artifacts.require('QuorumVote');
const Reputation = artifacts.require('Reputation');

const ERC827TokenMock = artifacts.require('./test/ERC827TokenMock.sol');
const GenesisProtocol = artifacts.require("./GenesisProtocol.sol");
const GenesisProtocolCallbacks = artifacts.require("./GenesisProtocolCallbacksMock.sol");



const setupGenesisProtocol = async function (accounts,_voteOnBehalf = helpers.NULL_ADDRESS,
                                              _quedVoteRequiredPercentage=50,
                                              _quedVotePeriodLimit=60,
                                              _boostedVotePeriodLimit=60,
                                              _preBoostedVotePeriodLimit =0,
                                              _thresholdConstA=1500,
                                              _quietEndingPeriod=0,
                                              _proposingRepRewardConstA=60,
                                              _votersReputationLossRatio=10,
                                              _minimumDaoBounty=15,
                                              _daoBountyConst=10) {
   var testSetup = new helpers.TestSetup();
   testSetup.stakingToken = await ERC827TokenMock.new(accounts[0],3000);
   testSetup.genesisProtocol = await GenesisProtocol.new(testSetup.stakingToken.address,{gas:constants.GAS_LIMIT});

   testSetup.reputationArray = [20, 10, 70 ];
   testSetup.org = {};
   //let reputationMinimeTokenFactory = await ReputationMinimeTokenFactory.new();
   testSetup.org.reputation  = await Reputation.new();
   await testSetup.org.reputation.mint(accounts[0],testSetup.reputationArray[0]);
   await testSetup.org.reputation.mint(accounts[1],testSetup.reputationArray[1]);
   await testSetup.org.reputation.mint(accounts[2],testSetup.reputationArray[2]);
   await testSetup.stakingToken.transfer(accounts[1],1000);
   await testSetup.stakingToken.transfer(accounts[2],1000);

   testSetup.genesisProtocolCallbacks = await GenesisProtocolCallbacks.new(testSetup.org.reputation.address,testSetup.stakingToken.address,testSetup.genesisProtocol.address);
   await testSetup.org.reputation.transferOwnership(testSetup.genesisProtocolCallbacks.address);

   testSetup.genesisProtocolParams= await setupGenesisProtocolParams(testSetup,
                                         _voteOnBehalf,
                                         _quedVoteRequiredPercentage,
                                         _quedVotePeriodLimit,
                                         _boostedVotePeriodLimit,
                                         _preBoostedVotePeriodLimit,
                                         _thresholdConstA,
                                         _quietEndingPeriod,
                                         _proposingRepRewardConstA,
                                         _votersReputationLossRatio,
                                         _minimumDaoBounty,
                                         _daoBountyConst);


   return testSetup;
};


export class GenesisProtocolParams {
  constructor() {
  }
}

const setupGenesisProtocolParams = async function(
                                            testSetup,
                                            voteOnBehalf = 0,
                                            _quedVoteRequiredPercentage=50,
                                            _quedVotePeriodLimit=60,
                                            _boostedVotePeriodLimit=60,
                                            _preBoostedVotePeriodLimit =0,
                                            _thresholdConstA=1500,
                                            _quietEndingPeriod=0,
                                            _proposingRepRewardConstA=60,
                                            _votersReputationLossRatio=10,
                                            _minimumDaoBounty=15,
                                            _daoBountyConst=10
                                            ) {
  var genesisProtocolParams = new GenesisProtocolParams();
  await testSetup.genesisProtocolCallbacks.setParameters([_quedVoteRequiredPercentage,
                                                          _quedVotePeriodLimit,
                                                          _boostedVotePeriodLimit,
                                                          _preBoostedVotePeriodLimit,
                                                          _thresholdConstA,
                                                          _quietEndingPeriod,
                                                          _proposingRepRewardConstA,
                                                          _votersReputationLossRatio,
                                                          _minimumDaoBounty,
                                                          _daoBountyConst],voteOnBehalf);
  genesisProtocolParams.paramsHash = await testSetup.genesisProtocol.getParametersHash([_quedVoteRequiredPercentage,
                                                          _quedVotePeriodLimit,
                                                          _boostedVotePeriodLimit,
                                                          _preBoostedVotePeriodLimit,
                                                          _thresholdConstA,
                                                          _quietEndingPeriod,
                                                          _proposingRepRewardConstA,
                                                          _votersReputationLossRatio,
                                                          _minimumDaoBounty,
                                                          _daoBountyConst],voteOnBehalf);
  return genesisProtocolParams;
};


contract('VotingMachine', (accounts)=>{
  it('proposalId should be globally unique', async () =>{
    const absolute = await AbsoluteVote.new();
    const quorum = await QuorumVote.new();

    const absoluteParams = await absolute.setParameters.call(50,true);
    await absolute.setParameters(50,true);
    var testSetup = await setupGenesisProtocol(accounts);
    const quoromParams = await quorum.setParameters.call(50,true);
    await quorum.setParameters(50,true);
    const absoluteProposalId = await absolute.propose(5, absoluteParams,accounts[0],helpers.NULL_ADDRESS);

    const genesisProposalId = await testSetup.genesisProtocol.propose(2, testSetup.genesisProtocolParams.paramsHash,accounts[0],helpers.NULL_ADDRESS);
    const quorumProposalId = await quorum.propose(5, quoromParams,accounts[0],helpers.NULL_ADDRESS);

    assert(absoluteProposalId !== genesisProposalId, 'AbsoluteVote gives the same proposalId as GenesisProtocol');
    assert(genesisProposalId !== quorumProposalId, 'GenesisProtocol gives the same proposalId as QuorumVote');
    assert(quorumProposalId !== absoluteProposalId, 'QuorumVote gives the same proposalId as AbsoluteVote');
  });
});
