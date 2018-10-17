const helpers = require('./helpers');
const constants = require('./constants');
import { getValueFromLogs } from './helpers';
const GenesisProtocol = artifacts.require("./GenesisProtocol.sol");
const ERC827TokenMock = artifacts.require('./test/ERC827TokenMock.sol');
const GenesisProtocolCallbacks = artifacts.require("./GenesisProtocolCallbacksMock.sol");
var ethereumjs = require('ethereumjs-abi');
const Reputation = artifacts.require("./Reputation.sol");

export class GenesisProtocolParams {
  constructor() {
  }
}

const setupGenesisProtocolParams = async function(
                                            testSetup,
                                            voteOnBehalf = 0,
                                            _preBoostedVoteRequiredPercentage=50,
                                            _preBoostedVotePeriodLimit=60,
                                            _boostedVotePeriodLimit=60,
                                            _thresholdConstA=1,
                                            _thresholdConstB=1,
                                            _minimumStakingFee=0,
                                            _quietEndingPeriod=0,
                                            _proposingRepRewardConstA=60,
                                            _proposingRepRewardConstB=1,
                                            _stakerFeeRatioForVoters=10,
                                            _votersReputationLossRatio=10,
                                            _votersGainRepRatioFromLostRep=80,
                                            _daoBountyConst=15,
                                            _daoBountyLimt=10
                                            ) {
  var genesisProtocolParams = new GenesisProtocolParams();
  await testSetup.genesisProtocolCallbacks.setParameters([_preBoostedVoteRequiredPercentage,
                                                 _preBoostedVotePeriodLimit,
                                                 _boostedVotePeriodLimit,
                                                 _thresholdConstA,
                                                 _thresholdConstB,
                                                 _minimumStakingFee,
                                                 _quietEndingPeriod,
                                                 _proposingRepRewardConstA,
                                                 _proposingRepRewardConstB,
                                                 _stakerFeeRatioForVoters,
                                                 _votersReputationLossRatio,
                                                 _votersGainRepRatioFromLostRep,
                                                 _daoBountyConst,
                                                 _daoBountyLimt],
                                                 voteOnBehalf);
  genesisProtocolParams.paramsHash = await testSetup.genesisProtocol.getParametersHash([_preBoostedVoteRequiredPercentage,
                                                 _preBoostedVotePeriodLimit,
                                                 _boostedVotePeriodLimit,
                                                 _thresholdConstA,
                                                 _thresholdConstB,
                                                 _minimumStakingFee,
                                                 _quietEndingPeriod,
                                                 _proposingRepRewardConstA,
                                                 _proposingRepRewardConstB,
                                                 _stakerFeeRatioForVoters,
                                                 _votersReputationLossRatio,
                                                 _votersGainRepRatioFromLostRep,
                                                 _daoBountyConst,
                                                 _daoBountyLimt],
                                                 voteOnBehalf);
  return genesisProtocolParams;
};

var YES,NO;
const setup = async function (accounts,_voteOnBehalf = 0,
                                      _preBoostedVoteRequiredPercentage=50,
                                      _preBoostedVotePeriodLimit=60,
                                      _boostedVotePeriodLimit=60,
                                      _thresholdConstA=1,
                                      _thresholdConstB=1,
                                      _minimumStakingFee=0,
                                      _quietEndingPeriod=0,
                                      _proposingRepRewardConstA=60000,
                                      _proposingRepRewardConstB=1000,
                                      _stakerFeeRatioForVoters=10,
                                      _votersReputationLossRatio=10,
                                      _votersGainRepRatioFromLostRep=80,
                                      _daoBountyConst = 15,
                                      _daoBountyLimt =10) {
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
                                         _preBoostedVoteRequiredPercentage,
                                         _preBoostedVotePeriodLimit,
                                         _boostedVotePeriodLimit,
                                         _thresholdConstA,
                                         _thresholdConstB,
                                         _minimumStakingFee,
                                         _quietEndingPeriod,
                                         _proposingRepRewardConstA,
                                         _proposingRepRewardConstB,
                                         _stakerFeeRatioForVoters,
                                         _votersReputationLossRatio,
                                         _votersGainRepRatioFromLostRep,
                                         _daoBountyConst,
                                         _daoBountyLimt);
    YES = await testSetup.genesisProtocol.YES();
    YES = YES.toNumber();
    NO = await testSetup.genesisProtocol.NO();
    NO = NO.toNumber();
    testSetup.proposer =  accounts[0];
   return testSetup;
};

const proposalStateIndex = 6;
const proposalVotersStakesIndex = 3;
const proposalTotalStakesIndex = 2;
const numberOfChoices = 2;
const checkProposalInfo = async function(proposalId, _proposalInfo,genesisProtocol) {
  let proposalInfo;
  proposalInfo = await genesisProtocol.proposals(proposalId);

  // proposalInfo has the following structure
  // address avatar;
  assert.equal(proposalInfo[0], _proposalInfo[0]);
  // uint numOfChoices;
  assert.equal(proposalInfo[1], _proposalInfo[1]);
    // ExecutableInterface executable;
  assert.equal(proposalInfo[2], _proposalInfo[2]);
    // votersStakes
  assert.equal(proposalInfo[3], _proposalInfo[3]);
  //submittedTime; for now do not test for submittedTime
  assert.equal(proposalInfo[4], _proposalInfo[4]);
    //boostedPhaseTime;
  assert.equal(proposalInfo[5], _proposalInfo[5]);
  //state
  assert.equal(proposalInfo[6], _proposalInfo[6]);
  //winningVote
  assert.equal(proposalInfo[7], _proposalInfo[7]);
  //proposer;
  assert.equal(proposalInfo[8], _proposalInfo[8]);
  //boostedVotePeriodLimit;
  assert.equal(proposalInfo[9], _proposalInfo[9]);
  //paramsHash;
  assert.equal(proposalInfo[10], _proposalInfo[10]);
  assert.equal(proposalInfo[11], _proposalInfo[11]);
  //daoBountyRemain;
  // - the mapping and array are simply not returned at all in the array
};

const checkVotesStatus = async function(proposalId, _votesStatus,genesisProtocol){
   return helpers.checkVotesStatus(proposalId, _votesStatus,genesisProtocol);
};

const checkIsVotable = async function(proposalId, _votable,genesisProtocol){
  let votable;

  votable = await genesisProtocol.isVotable(proposalId);
  assert.equal(votable, _votable);
};

const checkVoteInfo = async function(proposalId, voterAddress, _voteInfo, genesisProtocol) {
  let voteInfo;
  voteInfo = await genesisProtocol.voteInfo(proposalId, voterAddress);
  // voteInfo has the following structure
  // int vote;
  assert.equal(voteInfo[0], _voteInfo[0]);
  // uint reputation;
  assert.equal(voteInfo[1], _voteInfo[1]);
};



const propose = async function(_testSetup,_proposer = 0) {
      if (_proposer === 0) {
         _proposer = _testSetup.proposer;
      }
      let tx = await _testSetup.genesisProtocolCallbacks.propose(numberOfChoices,
                                                                _testSetup.genesisProtocolParams.paramsHash,
                                                                _testSetup.genesisProtocolCallbacks.address,
                                                                _proposer,
                                                                 helpers.NULL_ADDRESS);
      const proposalId = await getValueFromLogs(tx, '_proposalId');
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, "NewProposal");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._proposer, _proposer);
      assert.equal(tx.logs[0].args._paramsHash, _testSetup.genesisProtocolParams.paramsHash);
      assert.equal(proposalId,await helpers.getProposalId(tx,_testSetup.genesisProtocol,"NewProposal"));
      assert.isOk(proposalId);
      return proposalId;
  };

const threshold = async function(_testSetup) {
      const organizationId = await web3.utils.soliditySha3(_testSetup.genesisProtocolCallbacks.address,helpers.NULL_ADDRESS);
      return await _testSetup.genesisProtocol.threshold(_testSetup.genesisProtocolParams.paramsHash,organizationId);
};

const signatureType = 1;
var nonce = 0;
const stake = async function(_testSetup,_proposalId,_vote,_amount,_staker) {
  var textMsg = "0x"+ethereumjs.soliditySHA3(
    ["address","bytes32","uint", "uint","uint"],
    [_testSetup.genesisProtocol.address, _proposalId,_vote,_amount, nonce]
  ).toString("hex");
  const signature = await web3.eth.sign(textMsg, _staker);
  const encodeABI = await new web3.eth.Contract(_testSetup.genesisProtocol.abi).methods.stakeWithSignature(_proposalId,_vote,_amount,nonce,signatureType,signature).encodeABI();

  nonce++;

  const transaction = await _testSetup.stakingToken.approveAndCall(
    _testSetup.genesisProtocol.address, _amount, encodeABI ,{from : _staker}
  );
  var stakeLog;
  await _testSetup.genesisProtocol.getPastEvents('Stake',
          {_proposalId: _proposalId},
          {fromBlock: transaction.blockNumber}
       )
      .then(function(events){
          stakeLog = events;
      });

  return stakeLog;
};



//use this method to approve and call stake with GEN token
//GEN token use old version of ERC827 which implemnt approve with data abi by
//overloading standardToken approve function approve(address _spender,uint256 _amount,bytes data);
//  const stakeGENToken = async function(_testSetup,_proposalId,_vote,_amount,_staker) {
//    var textMsg = "0x"+ethereumjs.soliditySHA3(
//      ["address","bytes32","uint", "uint","uint"],
//      [_testSetup.genesisProtocol.address, _proposalId,_vote,_amount, nonce]
//    ).toString("hex");
//    const signature = web3.eth.sign(_staker, textMsg);
//   var ethjsABI = require('ethjs-abi');
//   const extraData = await _testSetup.genesisProtocol.stake.request(_proposalId,_vote,_amount,nonce,signature);
//
//   const abiMethodString = '{ "constant": false,' +
//      '"inputs":[ { "name": "_spender", "type": "address" },' +
//      '{ "name": "_value", "type": "uint256" },' +
//      '{ "name": "_data", "type": "bytes" } ],' +
//      '"name": "approve",' +
//      '"outputs": [ { "name": "", "type": "bool"} ],'+
//      '"payable": false,' +
//      '"stateMutability": "nonpayable",' +
//      '"type": "function" }';
//   var abiMethod = JSON.parse(abiMethodString);
//
//   const approveData = ethjsABI.encodeMethod(abiMethod,
//     [_testSetup.genesisProtocol.address, _amount, extraData.params[0].data]
//   );
//   const transaction = await _testSetup.stakingToken.sendTransaction(
//     { from : _staker,data: approveData }
//   );
//   const stakeLog = await new Promise((resolve) => {
//               _testSetup.genesisProtocol.Stake({_proposalId: _proposalId}, {fromBlock: transaction.blockNumber})
//                   .get((err,events) => {
//                           resolve(events);
//                   });
//               });
//   return stakeLog;
// };


contract('GenesisProtocol Lite', accounts => {

  it("staking token address", async() => {
    var testSetup = await setup(accounts);
    assert.equal(await testSetup.genesisProtocol.stakingToken(),testSetup.stakingToken.address);
  });

  it("Sanity checks", async function () {
      var testSetup = await setup(accounts);
      let winningVote = 2;
      let state = 3; //PreBoosted

      //propose a vote
      const proposalId = await propose(testSetup);
      const organizationId = await web3.utils.soliditySha3(testSetup.genesisProtocolCallbacks.address,helpers.NULL_ADDRESS);
      var submittedTime = (await  web3.eth.getBlock("latest")).timestamp;

      await checkProposalInfo(proposalId, [
                                          organizationId,
                                          testSetup.genesisProtocolCallbacks.address,
                                          numberOfChoices,
                                          0,
                                          submittedTime,
                                          0,
                                          state,
                                          winningVote,
                                          accounts[0],
                                          60,
                                          testSetup.genesisProtocolParams.paramsHash,
                                          0
                                          ],testSetup.genesisProtocol);
      await checkVotesStatus(proposalId, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],testSetup.genesisProtocol);
      await checkIsVotable(proposalId, true,testSetup.genesisProtocol);

      // now lets vote Option 2 with a minority reputation

      await testSetup.genesisProtocol.vote(proposalId, 1,0);

      winningVote = 1;
      var proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
      assert.equal(testSetup.reputationArray[0],proposalStatus[0]);
      assert.equal(0,proposalStatus[1]);
      await checkProposalInfo(proposalId, [
                                           organizationId,
                                           testSetup.genesisProtocolCallbacks.address,
                                           numberOfChoices,
                                           0,
                                           submittedTime,
                                           0,
                                           state,
                                           winningVote,
                                           accounts[0],
                                           60,
                                           testSetup.genesisProtocolParams.paramsHash,
                                           0
                                           ],testSetup.genesisProtocol);
      await checkVoteInfo(proposalId, accounts[0], [1, testSetup.reputationArray[0]],testSetup.genesisProtocol);
      await checkVotesStatus(proposalId, [0, testSetup.reputationArray[0],0],testSetup.genesisProtocol);
      await checkIsVotable(proposalId, true,testSetup.genesisProtocol);
      // another minority reputation (Option 0):
      await testSetup.genesisProtocol.vote(proposalId, 2, 0,{ from: accounts[1] });
      await checkVoteInfo(proposalId, accounts[1], [2, testSetup.reputationArray[1]],testSetup.genesisProtocol);
      proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
      assert.equal(testSetup.reputationArray[0],proposalStatus[0]);
      assert.equal(testSetup.reputationArray[1],proposalStatus[1]);

      await checkProposalInfo(proposalId,[
                                           organizationId,
                                           testSetup.genesisProtocolCallbacks.address,
                                           numberOfChoices,
                                           0,
                                          submittedTime,
                                          0,
                                          state,
                                          winningVote,
                                          accounts[0],
                                          60,
                                          testSetup.genesisProtocolParams.paramsHash,
                                          0
                                          ],testSetup.genesisProtocol);

      await checkVotesStatus(proposalId, [0,testSetup.reputationArray[0], testSetup.reputationArray[1]],testSetup.genesisProtocol);
      await checkIsVotable(proposalId, true,testSetup.genesisProtocol);
  });

  it("check organization params validity", async function() {
    var preBoostedVoteRequiredPercentage = 0;
    var stakerFeeRatioForVoters = 1;
    var votersReputationLossRatio = 1;
    var votersGainRepRatioFromLostRep =1 ;
    var proposingRepRewardConstB = 0;
    var scoreThresholdParamsA = 8;
    var scoreThresholdParamsB = 9;

    try {
      await setup(accounts,0,
                  0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  1,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " 0 < preBoostedVoteRequiredPercentage <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    preBoostedVoteRequiredPercentage = 101;


    try {
      await setup(accounts,0,
                  0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  1,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " 0 < preBoostedVoteRequiredPercentage <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    preBoostedVoteRequiredPercentage = 100;
    stakerFeeRatioForVoters = 101;

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  1,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " stakerFeeRatioForVoters <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }
    stakerFeeRatioForVoters = 100;
    votersReputationLossRatio = 101;

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  1,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " votersReputationLossRatio <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    votersReputationLossRatio = 100;
    votersGainRepRatioFromLostRep = 101;

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  1,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " votersGainRepRatioFromLostRep <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    votersGainRepRatioFromLostRep = 100;
    scoreThresholdParamsB = 0;

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  proposingRepRewardConstB,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " scoreThresholdParamsB > 0 ");
    } catch(error) {
      helpers.assertVMException(error);
    }
    scoreThresholdParamsB = web3.utils.toWei("100000001");

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  proposingRepRewardConstB,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " scoreThresholdParamsB < 100000000* 10^8 ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    scoreThresholdParamsB = 1;
    scoreThresholdParamsA = web3.utils.toWei("100000001");

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  proposingRepRewardConstB,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " scoreThresholdParamsA < 100000000* 10^8 ");
    } catch(error) {
      helpers.assertVMException(error);
    }
    scoreThresholdParamsA = web3.utils.toWei("100000001");

    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  proposingRepRewardConstB,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " scoreThresholdParamsA < 100000000* 10^8 ");
    } catch(error) {
      helpers.assertVMException(error);
    }
    scoreThresholdParamsA = 1;
    proposingRepRewardConstB = web3.utils.toWei("100000001");
    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  60,
                  proposingRepRewardConstB,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " proposingRepRewardConstB < 100000000* 10^8 ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    proposingRepRewardConstB = 1;
    let proposingRepRewardConstA = web3.utils.toWei("100000001");
    try {
      await setup(accounts,0,
                  preBoostedVoteRequiredPercentage,
                  60,
                  60,
                  scoreThresholdParamsA,
                  scoreThresholdParamsB,
                  0,
                  20,
                  proposingRepRewardConstA,
                  proposingRepRewardConstB,
                  stakerFeeRatioForVoters,
                  votersReputationLossRatio,
                  votersGainRepRatioFromLostRep,
                  0);
      assert(false, " proposingRepRewardConstA < 100000000* 10^8 ");
    } catch(error) {
      helpers.assertVMException(error);
    }


  });

  it("log the VoteProposal event on voting ", async function() {
    var testSetup = await setup(accounts);


    const proposalId = await propose(testSetup);

    let voteTX = await testSetup.genesisProtocol.vote(proposalId, 1,0);

    assert.equal(voteTX.logs.length, 1);
    assert.equal(voteTX.logs[0].event, "VoteProposal");
    assert.equal(voteTX.logs[0].args._proposalId, proposalId);
    assert.equal(voteTX.logs[0].args._voter, accounts[0]);
    assert.equal(voteTX.logs[0].args._vote, 1);
    assert.equal(voteTX.logs[0].args._balance, testSetup.reputationArray[0]);
  });

  it("should log the ExecuteProposal event", async function() {
    var testSetup = await setup(accounts);


    const proposalId = await propose(testSetup);


    // now lets vote with a minority reputation
    await testSetup.genesisProtocol.vote(proposalId, 1,0);

    //test that reputation change does not effect the snapshot
    var account2Rep =await testSetup.org.reputation.balanceOf(accounts[2]);
    assert.equal(account2Rep,70);
    await testSetup.genesisProtocolCallbacks.burnReputationTest(account2Rep,accounts[2],helpers.NULL_HASH);

    account2Rep =await testSetup.org.reputation.balanceOf(accounts[2]);
    assert.equal(account2Rep,0);

    // // the decisive vote is cast now and the proposal will be executed
    var tx = await testSetup.genesisProtocol.vote(proposalId, 2,0, { from: accounts[2] });
    assert.equal(tx.logs.length, 3);
    assert.equal(tx.logs[1].event, "ExecuteProposal");
    assert.equal(tx.logs[1].args._proposalId, proposalId);
    assert.equal(tx.logs[1].args._decision, 2);
    assert.equal(tx.logs[2].event, "GPExecuteProposal");
    assert.equal(tx.logs[2].args._executionState, 2);
  });

  it("should log the ExecuteProposal event after time pass for preBoostedVotePeriodLimit (decision == 2 )", async function() {
    var testSetup = await setup(accounts,0,50,2);

    const proposalId = await propose(testSetup);


    // now lets vote with a minority reputation
    await testSetup.genesisProtocol.vote(proposalId, 1,0);
    await helpers.increaseTime(3);
    // the decisive vote is cast now and the proposal will be executed
    var tx = await testSetup.genesisProtocol.vote(proposalId, 1,0, { from: accounts[2] });
    assert.equal(tx.logs.length, 2);
    assert.equal(tx.logs[0].event, "ExecuteProposal");
    assert.equal(tx.logs[0].args._proposalId, proposalId);
    assert.equal(tx.logs[0].args._decision, 2);
    assert.equal(tx.logs[1].event, "GPExecuteProposal");
    assert.equal(tx.logs[1].args._executionState, 1);
    await testSetup.genesisProtocolCallbacks.getPastEvents('LogBytes32',
            {fromBlock: tx.blockNumber}
         )
        .then(function(events){
            assert.equal(events[0].args._msg,proposalId);
        });

  });

  it("All options can be voted (1-2)", async function() {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    // Option 1
    await testSetup.genesisProtocol.vote(proposalId, 1,0);
    await checkVoteInfo(proposalId, accounts[0], [1, testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkVotesStatus(proposalId, [0,testSetup.reputationArray[0], 0],testSetup.genesisProtocol);
    await checkIsVotable(proposalId,true,testSetup.genesisProtocol);


    testSetup = await setup(accounts);
    var tx = await testSetup.genesisProtocolCallbacks.propose(2, testSetup.genesisProtocolParams.paramsHash,0,accounts[0],helpers.NULL_ADDRESS);
    proposalId = await getValueFromLogs(tx, '_proposalId');

    // Option 2
    await testSetup.genesisProtocol.vote(proposalId, 2,0);
    await checkVoteInfo(proposalId, accounts[0], [2, testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkVotesStatus(proposalId, [0,0, testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkIsVotable(proposalId,true,testSetup.genesisProtocol);
  });

  it("cannot re vote", async function() {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    await testSetup.genesisProtocol.vote(proposalId, 2,0);
    await checkVoteInfo(proposalId, accounts[0], [2, testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkVotesStatus(proposalId, [0,0,testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkIsVotable(proposalId,true,testSetup.genesisProtocol);

    await testSetup.genesisProtocol.vote(proposalId, 1,0);
    await checkVoteInfo(proposalId, accounts[0], [2, testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkVotesStatus(proposalId, [0,0,testSetup.reputationArray[0]],testSetup.genesisProtocol);
    await checkIsVotable(proposalId,true,testSetup.genesisProtocol);
  });



  it("Non-existent parameters hash shouldn't work - propose with wrong organization", async function() {
    var testSetup = await setup(accounts);
    await testSetup.genesisProtocolCallbacks.propose(2, testSetup.genesisProtocolParams.paramsHash,0,accounts[0],helpers.NULL_ADDRESS);

    try {
      await testSetup.genesisProtocolCallbacks.propose(2, helpers.NULL_HASH, 0,accounts[0],helpers.NULL_ADDRESS);
      assert(false, "propose was supposed to throw because wrong organization address was sent");
    } catch(error) {
      helpers.assertVMException(error);
    }

  });

  it("Invalid percentage required( < 0 || > 100) shouldn't work", async function() {
    try {
      await setup(accounts,0,150);
      assert(false, "setParameters was supposed to throw but didn't.");
    } catch(error) {
      helpers.assertVMException(error);
    }

    try {
      await setup(accounts,0,-50);
      assert(false, "setParameters was supposed to throw but didn't.");
    } catch(error) {
      helpers.assertVMException(error);
    }
  });

  it("Proposal voting  shouldn't be able after proposal has been executed", async function () {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    // After this voting the proposal should be executed
    await testSetup.genesisProtocol.vote(proposalId, 2,0, {from: accounts[2]});

    // Should not be able to vote because the proposal has been executed
    try {
        await testSetup.genesisProtocol.vote(proposalId, 1,0, { from: accounts[1] });
        assert(false, "vote was supposed to throw but didn't.");
    } catch (error) {
        helpers.assertVMException(error);
    }

  });

  it("the vote function should behave as expected", async function () {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);
    const organizationId = await web3.utils.soliditySha3(testSetup.genesisProtocolCallbacks.address,helpers.NULL_ADDRESS);
    // no one has voted yet at this point
    var submittedTime = (await  web3.eth.getBlock("latest")).timestamp;
    var state = 3;
    var winningVote = 2;
    await checkProposalInfo(proposalId, [organizationId,
                                        testSetup.genesisProtocolCallbacks.address,
                                             2,
                                            0,
                                            submittedTime,
                                            0,
                                            state,
                                            winningVote,
                                            accounts[0],
                                            60,
                                            testSetup.genesisProtocolParams.paramsHash,
                                            0
                                             ],testSetup.genesisProtocol);
    // lets try to vote by the owner on the behalf of non-existent voters(they do exist but they aren't registered to the reputation system).
    for (var i = 3; i < accounts.length; i++) {
        await testSetup.genesisProtocol.vote(proposalId, 1, 0 ,{ from: accounts[i] });
    }
    // everything should be 0
    await checkVotesStatus(proposalId, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],testSetup.genesisProtocol);

  });

  it('Proposal with wrong num of options', async function () {
      var testSetup = await setup(accounts);

    // 3 options - max is 2 - exception should be raised
    try {
      await testSetup.genesisProtocolCallbacks.propose(3, helpers.NULL_HASH, testSetup.genesisProtocolCallbacks.address,accounts[0],helpers.NULL_ADDRESS);
      assert(false, 'Tried to create a proposal with 3 options - max is 2');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // -5 options - exception should be raised
    try {
      await testSetup.genesisProtocolCallbacks.propose(-5, helpers.NULL_HASH, testSetup.genesisProtocolCallbacks.address,accounts[0],helpers.NULL_ADDRESS);
      assert(false, 'Tried to create an absolute vote with negative number of options');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // 0 options - exception should be raised
    try {
      await testSetup.genesisProtocolCallbacks.propose(0, helpers.NULL_HASH ,testSetup.genesisProtocolCallbacks.address,accounts[0],helpers.NULL_ADDRESS);
      assert(false, 'Tried to create an absolute vote with 0 number of options');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it('Test voteWithSpecifiedAmounts - More reputation than I own, negative reputation, etc..', async function () {
      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);


    // Vote with the reputation the I own - should work
    await testSetup.genesisProtocol.voteWithSpecifiedAmounts(proposalId, 1, testSetup.reputationArray[0], 0);

    // Vote with more reputation that i own - exception should be raised
    try {
      await testSetup.genesisProtocol.voteWithSpecifiedAmounts(proposalId, 1, (testSetup.reputationArray[1] + 1), 0,{from:accounts[1]});
      assert(false, 'Not enough reputation - voting shouldn\'t work');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // Vote with a very big number - exception should be raised
    let BigNumber = require('bignumber.js');
    let bigNum = ((new BigNumber(2)).toPower(254));
    try {
      await testSetup.genesisProtocol.voteWithSpecifiedAmounts(proposalId, 1, bigNum, 0);
      assert(false, 'Voting shouldn\'t work');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it("Internal functions can not be called externally", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    // Lets try to call internalVote function
    try {
      await testSetup.genesisProtocol.internalVote(proposalId, accounts[0], 1, testSetup.reputationArray[0]);
      assert(false, 'Can\'t call internalVote');
    } catch (ex) {
      helpers.assertInternalFunctionException(ex);
    }
  });

  it("Try to send wrong proposal id to the voting/cancel functions", async () => {

    var testSetup = await setup(accounts);

    await propose(testSetup);


    // Lets try to call vote with invalid proposal id
    try {
      await testSetup.genesisProtocol.vote(helpers.NULL_HASH, 1,0, {from: accounts[0]});
      assert(false, 'Invalid proposal ID has been delivered');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // Lets try to call voteWithSpecifiedAmounts with invalid proposal id
    try {
      await testSetup.genesisProtocol.voteWithSpecifiedAmounts(helpers.NULL_HASH, 1, 1, 0);
      assert(false, 'Invalid proposal ID has been delivered');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // Lets try to call execute with invalid proposal id
    try {
      await testSetup.genesisProtocol.execute(helpers.NULL_HASH);
      assert(false, 'Invalid proposal ID has been delivered');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it("stake with approveAndCall log", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);
    var tx = await stake(testSetup,proposalId,1,10,accounts[0]);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
  });

  it("stake log", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    await testSetup.stakingToken.approve(testSetup.genesisProtocol.address,10);

    var tx = await testSetup.genesisProtocol.stake(proposalId,1,10);
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "Stake");
    assert.equal(tx.logs[0].args._staker, accounts[0]);
    assert.equal(tx.logs[0].args._vote, 1);
    assert.equal(tx.logs[0].args._amount, 10);
  });

  it("check nonce ", async () => {

    var testSetup = await setup(accounts,0,50,60,60,100,100);
    var proposalId = await propose(testSetup);

    let staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],0);
    assert.equal(staker[1],0);

    var tx = await stake(testSetup,proposalId,1,10,accounts[0]);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
    staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],10);
     nonce--;
    var textMsg = "0x"+ethereumjs.soliditySHA3(
        ["address","bytes32","uint", "uint","uint"],
        [testSetup.genesisProtocol.address, proposalId,1,10, nonce]
      ).toString("hex");
    const signature = await web3.eth.sign(textMsg ,accounts[0]);
    const encodeABI = await new web3.eth.Contract(testSetup.genesisProtocol.abi).methods.stakeWithSignature(proposalId,1,10,nonce,signatureType,signature).encodeABI();
    try {
     await testSetup.stakingToken.approveAndCall(
        testSetup.genesisProtocol.address, 10, encodeABI ,{from : accounts[0]}
      );
      assert(false, 'stake should fail with the same nonce');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it("check stake with wrong signature ", async () => {

    var testSetup = await setup(accounts,0,50,60,60,100,100);

    var proposalId = await propose(testSetup);

    let staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],0);
    assert.equal(staker[1],0);
    var textMsg = "0x"+ethereumjs.soliditySHA3(
        ["address","bytes32","uint", "uint","uint"],
        [testSetup.genesisProtocol.address, proposalId,1,10, nonce]
      ).toString("hex");
    const signature = await web3.eth.sign(textMsg , accounts[0]);
    proposalId = "0x1234"; //change proposalId
    const encodeABI = await new web3.eth.Contract(testSetup.genesisProtocol.abi).methods.stakeWithSignature(proposalId,1,10,nonce,signatureType,signature).encodeABI();
    try {
     await testSetup.stakingToken.approveAndCall(
        testSetup.genesisProtocol.address, 10, encodeABI ,{from : accounts[0]}
      );
      assert(false, 'stake should fail due to wrong signature');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });


  it("multiple stakes ", async () => {

    var testSetup = await setup(accounts,0,50,60,60,100,100);

    var proposalId = await propose(testSetup);


    let staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],0);
    assert.equal(staker[1],0);

    var tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
    staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],10);

    //add more stake on the same vote
    tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
    staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],20);
    //try to stake with different vote as before
    tx = await stake(testSetup,proposalId,2,10,accounts[0]);
    staker = await testSetup.genesisProtocol.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],20);

    let proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[2],18); //totalStakes -votersFee - in this case voterFee = 10%  so
  });

  it("stake without approval - fail", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


      try {
        await testSetup.genesisProtocol.stake(proposalId,2,10);
        assert(false, 'stake without approval should revert');
      } catch (ex) {
        helpers.assertVMException(ex);
      }
  });


  it("stake with zero amount will fail", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    try {
      await stake(testSetup,proposalId,1,0,accounts[0]);
      assert(false, 'stake with zero amount should revert');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

  });

  it("stake on boosted proposal is not allowed", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    //shift proposal to boosted phase
    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    assert.equal(proposalInfo[proposalVotersStakesIndex],0);
    assert.equal(proposalInfo[proposalStateIndex],3);
    await testSetup.genesisProtocol.vote(proposalId,YES,0);

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);

    let proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[proposalTotalStakesIndex],90); //totalStakes
    assert.equal(proposalInfo[proposalVotersStakesIndex],10);  //voterStakes
    assert.equal(proposalInfo[proposalStateIndex],4);  //state boosted

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    //S = (S+) - (S-)
    var score = 100;
    assert.equal(await testSetup.genesisProtocol.score(proposalId),score);

    //try to stake on boosted proposal should fail
    var tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx.length, 0);
  });

  it("stake on boosted dual proposal is not allowed", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    //shift proposal to boosted phase
    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    assert.equal(proposalInfo[proposalVotersStakesIndex],0);
    assert.equal(proposalInfo[proposalStateIndex],3);
    await testSetup.genesisProtocol.vote(proposalId,YES,0);

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);

    let proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[proposalTotalStakesIndex],90); //totalStakes
    assert.equal(proposalInfo[proposalVotersStakesIndex],10);  //voterStakes
    assert.equal(proposalInfo[proposalStateIndex],4);   //state boosted

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    //S* POW(R/totalR)
    var score = 100;
    assert.equal(await testSetup.genesisProtocol.score(proposalId),score);

    //try to stake on boosted proposal should fail
    var tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx.length, 0);
  });

  it("shouldBoost ", async () => {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);

    await testSetup.genesisProtocol.vote(proposalId,YES,0);

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    assert.equal(await testSetup.genesisProtocol.score(proposalId),0);
    await stake(testSetup,proposalId,YES,100,accounts[0]);

    proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    let proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[proposalTotalStakesIndex],90); //totalStakes

    assert.equal(proposalInfo[proposalVotersStakesIndex],10);  //voterStakes
    assert.equal(proposalInfo[proposalStateIndex],4);   //state boosted

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    var score = 100;
    assert.equal(await testSetup.genesisProtocol.score(proposalId),score);

  });

  it("shouldBoost dual proposal   ", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);



    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);

    await testSetup.genesisProtocol.vote(proposalId,YES,0);

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    assert.equal(await testSetup.genesisProtocol.score(proposalId),0);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    let proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[proposalTotalStakesIndex],90); //totalStakes

    assert.equal(proposalInfo[proposalVotersStakesIndex],10);  //voterStakes
    assert.equal(proposalInfo[proposalStateIndex],4);   //state boosted

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    var score = 100;
    assert.equal(await testSetup.genesisProtocol.score(proposalId),score);
  });

  it("proposal score ", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);



    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);

    await testSetup.genesisProtocol.vote(proposalId,YES,0);

    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    let proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[proposalTotalStakesIndex],90); //totalStakes
    assert.equal(proposalInfo[proposalVotersStakesIndex],10);  //voterStakes
    assert.equal(proposalInfo[proposalStateIndex],4);   //state
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
  });

  it("stake on none votable phase should revert ", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    await testSetup.stakingToken.approve(testSetup.genesisProtocol.address,10);
    //vote with majority. state is executed
    await testSetup.genesisProtocol.vote(proposalId, 1,0, { from: accounts[2] });

    try {
      await stake(testSetup,proposalId,1,0,accounts[0]);
      assert(false, 'stake on executed phase should revert');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

  });

  it("threshold ", async () => {

    var testSetup = await setup(accounts);

    await propose(testSetup);

    assert.equal(await threshold(testSetup),1);

  });

  it("redeem ", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    await testSetup.genesisProtocol.vote(proposalId,YES,0);
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    await helpers.increaseTime(61);
    await testSetup.genesisProtocol.execute(proposalId);
    var redeemRewards = await testSetup.genesisProtocol.redeem.call(proposalId,accounts[0]);
    var redeemToken = redeemRewards[0].toNumber() + redeemRewards[2].toNumber();
    assert.equal(redeemToken,10+90);
    assert.equal(await testSetup.stakingToken.balanceOf(accounts[0]),900);
    var proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[3],100);
    var tx = await testSetup.genesisProtocol.redeem(proposalId,accounts[0]);
    proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    assert.equal(proposalStatus[3],0);
    assert.equal(tx.logs.length,2);
    assert.equal(tx.logs[0].event, "Redeem");
    assert.equal(tx.logs[0].args._proposalId, proposalId);
    assert.equal(tx.logs[0].args._beneficiary, accounts[0]);
    assert.equal(tx.logs[0].args._amount, redeemToken);
    assert.equal(await testSetup.stakingToken.balanceOf(accounts[0]),1000);
  });

  it("redeem without execution should revert", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    await testSetup.genesisProtocol.vote(proposalId,YES,0);
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    await testSetup.genesisProtocol.execute(proposalId);
    try {
      await  testSetup.genesisProtocol.redeem(proposalId,accounts[0]);
      assert(false, 'redeem before execution should revert');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

    it("dynamic threshold ", async () => {
      var testSetup = await setup(accounts);


      var proposalId = await propose(testSetup);
      const organizationId = await web3.utils.soliditySha3(testSetup.genesisProtocolCallbacks.address,helpers.NULL_ADDRESS);

      assert.equal(await threshold(testSetup),1);

      assert.equal(await testSetup.genesisProtocol.orgBoostedProposalsCnt(organizationId),0);

      await testSetup.genesisProtocol.vote(proposalId,YES,0);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
      assert.equal(await testSetup.genesisProtocol.state(proposalId),4);
      assert.equal(await testSetup.genesisProtocol.orgBoostedProposalsCnt(organizationId),1);
      assert.equal(await threshold(testSetup),2);

      //set up another proposal
      proposalId = await propose(testSetup);
      //boost it
      await testSetup.genesisProtocol.vote(proposalId,YES,0);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      assert.equal(await testSetup.genesisProtocol.state(proposalId),4);
      assert.equal(await testSetup.genesisProtocol.orgBoostedProposalsCnt(organizationId),2);
      assert.equal(await threshold(testSetup),4);

      //execute
      await helpers.increaseTime(61);
      await testSetup.genesisProtocol.execute(proposalId);
      assert.equal(await testSetup.genesisProtocol.orgBoostedProposalsCnt(organizationId),1);
      assert.equal(await threshold(testSetup),1);
    });

    it("reputation flow ", async () => {
      var voterY = accounts[0];
      var voterN = accounts[1];
      var proposer = accounts[2];
      var staker = accounts[2];

      var votersReputationLossRatio=20;
      var votersGainRepRatioFromLostRep=80;
      var testSetup = await setup(accounts,0,50,60,60,1,1,0,0,60,1,10,votersReputationLossRatio,votersGainRepRatioFromLostRep,15,10);

      var proposalId = await propose(testSetup,proposer);

      await testSetup.genesisProtocol.vote(proposalId,YES,0,{from:voterY});
      await testSetup.genesisProtocol.vote(proposalId,NO,0,{from:voterN});
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
      await testSetup.stakingToken.transfer(staker,500,{from:accounts[0]});
      await stake(testSetup,proposalId,YES,100,staker);
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
      await helpers.increaseTime(61);
      await testSetup.genesisProtocol.execute(proposalId);
      var redeemRewards = await testSetup.genesisProtocol.redeem.call(proposalId,voterY);
      var redeemToken = redeemRewards[0].toNumber() + redeemRewards[2].toNumber();
      var RedeemReputation = redeemRewards[1].toNumber() + redeemRewards[3].toNumber() + redeemRewards[4].toNumber();
      var repVoterY = testSetup.reputationArray[0];
      var repVoterN = testSetup.reputationArray[1];
      var preBoostedVotes = repVoterY + repVoterN;
      var lostReputation = (repVoterN * votersReputationLossRatio)/100;
      var voterYRepDeposit = (repVoterY * votersReputationLossRatio)/100;
      assert.equal(RedeemReputation,Math.round((voterYRepDeposit + (repVoterY *((lostReputation*votersGainRepRatioFromLostRep)/100)/ preBoostedVotes))));
      assert.equal(redeemToken,6);
      var tx = await testSetup.genesisProtocol.redeem(proposalId,voterY);
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, "Redeem");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, voterY);
      assert.equal(tx.logs[0].args._amount, redeemToken);
      assert.equal(tx.logs[1].event, "RedeemReputation");
      assert.equal(tx.logs[1].args._proposalId, proposalId);
      assert.equal(tx.logs[1].args._beneficiary, voterY);
      assert.equal(tx.logs[1].args._amount, RedeemReputation);
      assert.equal(await testSetup.stakingToken.balanceOf(voterY),500+redeemToken);
      assert.equal(await testSetup.org.reputation.balanceOf(voterY),Math.round(repVoterY+(repVoterY *((lostReputation*votersGainRepRatioFromLostRep)/100)/ preBoostedVotes)));
    });

    it("reputation flow for unsuccessful voting", async () => {
      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);

      await testSetup.genesisProtocol.vote(proposalId,YES,0);
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);

      await helpers.increaseTime(61);
      await testSetup.genesisProtocol.execute(proposalId);
      var redeemRewards = await testSetup.genesisProtocol.redeem.call(proposalId,accounts[0]);
      var totalRep = redeemRewards[1].toNumber() + redeemRewards[3].toNumber() +redeemRewards[4].toNumber();
      var tx = await testSetup.genesisProtocol.redeem(proposalId,accounts[0]);
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "RedeemReputation");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, accounts[0]);
      //var totalRep =  rep4Stake.toNumber() + rep4Vote.toNumber() + rep4Propose.toNumber();
      assert.equal(tx.logs[0].args._amount, totalRep);
      assert.equal(await testSetup.stakingToken.balanceOf(accounts[0]),1000);
      var loss = (10*testSetup.reputationArray[0])/100;  //votersReputationLossRatio
      assert.equal(await testSetup.org.reputation.balanceOf(accounts[0]),testSetup.reputationArray[0] + totalRep - loss);
    });

    it("quite window ", async () => {
      var quietEndingPeriod = 20;

      var testSetup = await setup(accounts,0,50,60,60,1,1,0,quietEndingPeriod,60,1,10,10,0,15,10);

      var proposalId = await propose(testSetup);


      await testSetup.genesisProtocol.vote(proposalId,YES,0,{from:accounts[1]});
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
      var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],4);//boosted

      await helpers.increaseTime(50); //get into the quite period
      assert.equal(await threshold(testSetup),2);

      await testSetup.genesisProtocol.vote(proposalId,NO,0,{from:accounts[0]}); //change winning vote
      assert.equal(await threshold(testSetup),2);

      proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],5);//quietEndingPeriod -still not execute
      await helpers.increaseTime(15); //increase time

      await testSetup.genesisProtocol.execute(proposalId);

      proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],5);//boosted -still not execute
      await helpers.increaseTime(10); //increase time
      assert.equal(await testSetup.genesisProtocol.getBoostedProposalsCount(testSetup.genesisProtocolCallbacks.address),0);

      await testSetup.genesisProtocol.execute(proposalId);

      assert.equal(await threshold(testSetup),1);

      assert.equal(await testSetup.genesisProtocol.getBoostedProposalsCount(testSetup.genesisProtocolCallbacks.address),0);

      proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],2);//executed
    });

    it("quite window with tie ", async () => {
      var quietEndingPeriod = 20;

      var testSetup = await setup(accounts,0,50,60,60,1,1,0,quietEndingPeriod,60,1,10,10,0,15,10);

      var proposalId = await propose(testSetup);
      await testSetup.genesisProtocol.vote(proposalId,YES,0,{from:accounts[1]});
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      await helpers.increaseTime(50); //get into the quite period
      var yesVotes = await testSetup.genesisProtocol.voteStatus(proposalId,YES);
      await testSetup.genesisProtocol.voteWithSpecifiedAmounts(proposalId,NO,yesVotes,0, {from:accounts[2]}); //change winning vote by create a tie.
      await helpers.increaseTime(15); //increase time
      await testSetup.genesisProtocol.execute(proposalId);
      var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],5);//boosted -still not execute
      await helpers.increaseTime(10); //increase time
      await testSetup.genesisProtocol.execute(proposalId);
      proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],2);//executed
      assert.equal(await testSetup.genesisProtocol.winningVote(proposalId),NO);
    });

    it("scoreThresholdParams and proposalAvatar", async () => {

      var scoreThresholdParamsA = 8;
      var scoreThresholdParamsB = 9;
      var testSetup = await setup(accounts,0,50,60,60,scoreThresholdParamsA,scoreThresholdParamsB,0,20,60,1,10,10,0,15,10);

      var proposalId = await propose(testSetup);
      const organizationId = await web3.utils.soliditySha3(testSetup.genesisProtocolCallbacks.address,helpers.NULL_ADDRESS);
      assert.equal(await testSetup.genesisProtocol.getProposalOrganization(proposalId),organizationId);
    });

    it('getAllowedRangeOfChoices', async function () {
      var testSetup = await setup(accounts);
      let allowedRange = await testSetup.genesisProtocol.getAllowedRangeOfChoices();

      assert.equal(allowedRange[0],2);
      assert.equal(allowedRange[1],2);
    });
    it("redeem dao bounty", async () => {

      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);


      await testSetup.genesisProtocol.vote(proposalId,YES,0);
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),false);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
      await helpers.increaseTime(61);
      await testSetup.genesisProtocol.execute(proposalId);
      var redeemRewards = await testSetup.genesisProtocol.redeemDaoBounty.call(proposalId,accounts[0]);
      var stakerRedeemAmountBaunty = redeemRewards[0];
      var potentialAmount = redeemRewards[1];
      assert.equal(potentialAmount,10);
      //'there is no tokens on the dao for bounty'
      assert.equal(stakerRedeemAmountBaunty,0);
      //send tokens to org avatar
      var tx = await testSetup.genesisProtocol.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,0); //not enough funds
      await testSetup.stakingToken.transfer(testSetup.genesisProtocolCallbacks.address,potentialAmount);
      tx = await testSetup.genesisProtocol.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,1);
      assert.equal(tx.logs[0].event, "RedeemDaoBounty");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, accounts[0]);
      assert.equal(tx.logs[0].args._amount, potentialAmount.toNumber());
      assert.equal(await testSetup.stakingToken.balanceOf(accounts[0]),900);
      tx = await testSetup.genesisProtocol.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,0);

    });

    it("redeem dao bounty for unsuccessful proposal", async () => {

      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);
      await stake(testSetup,proposalId,NO,100,accounts[0]);
      await testSetup.genesisProtocol.vote(proposalId,NO,0,{from:accounts[2]});
      var redeemRewards = await testSetup.genesisProtocol.redeemDaoBounty.call(proposalId,accounts[0]);
      var stakerRedeemAmountBaunty = redeemRewards[0];
      assert.equal(stakerRedeemAmountBaunty,0);
      //send tokens to org avatar
      var tx = await testSetup.genesisProtocol.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,0);
      assert.equal(await testSetup.stakingToken.balanceOf(accounts[0]),900);

    });

    it("vote on behalf ", async function() {
      var voteOnBehalf = accounts[1];
      var testSetup = await setup(accounts,voteOnBehalf);
      const proposalId = await propose(testSetup);
      try {
        await testSetup.genesisProtocol.vote(proposalId, 1,accounts[2],{from:accounts[0]});
        assert(false, 'can vote only from voteOnBehalf address');
      } catch (ex) {
        helpers.assertVMException(ex);
      }

      let voteTX = await testSetup.genesisProtocol.vote(proposalId, 1,accounts[2],{from:voteOnBehalf});

      assert.equal(voteTX.logs.length, 3);
      assert.equal(voteTX.logs[0].event, "VoteProposal");
      assert.equal(voteTX.logs[0].args._proposalId, proposalId);
      assert.equal(voteTX.logs[0].args._voter, accounts[2]);
      assert.equal(voteTX.logs[0].args._vote, 1);
      assert.equal(voteTX.logs[0].args._balance, testSetup.reputationArray[2]);
    });

    it("quite window double toggling direction", async () => {
    var quietEndingPeriod = 60;

    var testSetup = await setup(accounts,0,50,60,60,1,1,0,quietEndingPeriod,60,1,10,10,0,15,10);

    var proposalId = await propose(testSetup);
    const organizationId = await web3.utils.soliditySha3(testSetup.genesisProtocolCallbacks.address,helpers.NULL_ADDRESS);

    //boost proposal
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],4);//boosted
    //vote YES to get in quite window period
    await testSetup.genesisProtocol.vote(proposalId,YES,0,{from:accounts[0]}); //change winning vote
    proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],5);//quiteEndperiod
    await helpers.increaseTime(10); //increase time
    assert.equal(await testSetup.genesisProtocol.getBoostedProposalsCount(organizationId),1);
    //vote NO to toggle direction again and extend the quite end period
    await testSetup.genesisProtocol.vote(proposalId,NO,0,{from:accounts[2]}); //change winning vote and execute
    assert.equal(await testSetup.genesisProtocol.getBoostedProposalsCount(organizationId),0);
    //increase time after the proposal expiration
    await helpers.increaseTime(61); //increase time
    assert.equal(await threshold(testSetup),1);

  });

  it("pre boosted voters are rewarded from staker", async () => {
    var proposer = accounts[2];
    var staker   = accounts[1];
    var voter    = accounts[0];

    var testSetup = await setup(accounts,0,50,60,60,1,1,0,0,60,1,10,10,0,15,10);
    await testSetup.stakingToken.transfer(staker,500,{from:accounts[0]});


    var proposalId = await propose(testSetup,proposer);

    await testSetup.genesisProtocol.vote(proposalId,YES,0,{from:voter});
    //boost proposal
    await stake(testSetup,proposalId,YES,100,staker);
    assert.equal(await testSetup.genesisProtocol.shouldBoost(proposalId),true);
    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],4);//boosted
    await helpers.increaseTime(100); //increase time to execute
    await testSetup.genesisProtocol.execute(proposalId); //execute
    var redeemValues = await testSetup.genesisProtocol.redeem.call(proposalId,voter);
    var proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    var votersStakes = proposalInfo[proposalVotersStakesIndex];
    var preBoostedVotes = proposalStatus[1]+proposalStatus[0];
    assert.equal(preBoostedVotes,testSetup.reputationArray[0]);
    assert.equal(redeemValues[2].toNumber(),votersStakes.toNumber()*testSetup.reputationArray[0]/preBoostedVotes);
    assert.equal(redeemValues[2].toNumber(),10);
  });

  it("boosted voters are not rewarded from staker", async () => {
    var proposer = accounts[2];
    var staker   = accounts[1];
    var voter    = accounts[0];

    var testSetup = await setup(accounts,0,50,60,60,1,1,0,0,60,1,10,10,0,15,10);
    await testSetup.stakingToken.transfer(staker,500,{from:accounts[0]});

    var proposalId = await propose(testSetup,proposer);

    //boost proposal
    await stake(testSetup,proposalId,YES,100,staker);
    await testSetup.genesisProtocol.vote(proposalId,1,0,{from:voter});
    await helpers.increaseTime(100); //increase time to execute
    await testSetup.genesisProtocol.execute(proposalId); //execute
    var redeemValues = await testSetup.genesisProtocol.redeem.call(proposalId,voter);
    var proposalStatus = await testSetup.genesisProtocol.proposalStatus(proposalId);
    var proposalInfo = await testSetup.genesisProtocol.proposals(proposalId);
    var votersStakes = proposalInfo[proposalVotersStakesIndex];
    assert.equal(votersStakes,10);
    var preBoostedVotes = proposalStatus[1];
    assert.equal(preBoostedVotes,0);
    assert.equal(redeemValues[2].toNumber(),0);
  });

  it("set organization ", async () => {
      var testSetup = await setup(accounts);
      var tx = await testSetup.genesisProtocol.propose(2, testSetup.genesisProtocolParams.paramsHash,0,accounts[1]);
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NewProposal");
      assert.equal(tx.logs[0].args._organization,accounts[1]);
      var proposalId = await getValueFromLogs(tx, '_proposalId');
      var proposal = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposal[0],await web3.utils.soliditySha3(accounts[0],accounts[1]));


      tx = await testSetup.genesisProtocol.propose(2, testSetup.genesisProtocolParams.paramsHash,0,accounts[1],{from : accounts[1]});
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "NewProposal");
      assert.equal(tx.logs[0].args._organization,accounts[1]);
      proposalId = await getValueFromLogs(tx, '_proposalId');
      proposal = await testSetup.genesisProtocol.proposals(proposalId);
      assert.equal(proposal[0],await web3.utils.soliditySha3(accounts[1],accounts[1]));
  });


});
