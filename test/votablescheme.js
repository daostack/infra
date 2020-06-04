const helpers = require('./helpers');
const ERC827TokenMock = artifacts.require('./test/ERC827TokenMock.sol');
const VotableSchemeMock = artifacts.require("./VotableSchemeMock.sol");
var ethereumjs = require('ethereumjs-abi');
const Reputation = artifacts.require("./Reputation.sol");
const BigNumber = require('bignumber.js');

var YES,NO;

const setup = async function (accounts,
                              _voteOnBehalf = helpers.NULL_ADDRESS,
                              _queuedVoteRequiredPercentage=50,
                              _queuedVotePeriodLimit=60,
                              _boostedVotePeriodLimit=60,
                              _preBoostedVotePeriodLimit =0,
                              _thresholdConst=2000,
                              _quietEndingPeriod=0,
                              _proposingRepReward=60,
                              _votersReputationLossRatio=10,
                              _minimumDaoBounty=15,
                              _daoBountyConst=1000,
                              _activationTime=0,
                              _authorizedToPropose = helpers.NULL_ADDRESS) {
   var testSetup = new helpers.TestSetup();
   testSetup.stakingToken = await ERC827TokenMock.new(accounts[0],web3.utils.toWei(((new BigNumber(2)).pow(200)).toString(10)));
   testSetup.reputationArray = [200, 100, 700 ];
   testSetup.org = {};
   testSetup.org.reputation  = await Reputation.new();
   await testSetup.org.reputation.initialize(accounts[0]) ;
   await testSetup.org.reputation.mint(accounts[0],testSetup.reputationArray[0]);
   await testSetup.org.reputation.mint(accounts[1],testSetup.reputationArray[1]);
   await testSetup.org.reputation.mint(accounts[2],testSetup.reputationArray[2]);
   await testSetup.stakingToken.transfer(accounts[1],web3.utils.toWei('3'));
   await testSetup.stakingToken.transfer(accounts[2],1000);
   testSetup.votableSchemeMock = await VotableSchemeMock.new();
   await testSetup.votableSchemeMock.initialize(
     testSetup.org.reputation.address,
     testSetup.stakingToken.address,
     [_queuedVoteRequiredPercentage,
      _queuedVotePeriodLimit,
      _boostedVotePeriodLimit,
      _preBoostedVotePeriodLimit,
      _thresholdConst,
      _quietEndingPeriod,
      _proposingRepReward,
      _votersReputationLossRatio,
      _minimumDaoBounty,
      _daoBountyConst,
      _activationTime],
      _voteOnBehalf,
      _authorizedToPropose
   );
   await testSetup.org.reputation.transferOwnership(testSetup.votableSchemeMock.address);
   YES = await testSetup.votableSchemeMock.YES();
   YES = YES.toNumber();
   NO = await testSetup.votableSchemeMock.NO();
   NO = NO.toNumber();
   testSetup.proposer = accounts[0];
   return testSetup;
};

const proposalStateIndex = 0;
const boostedState = 5;
const preBoostedState = 4;
const proposalTotalStakesIndex = 6;
const numberOfChoices = 2;
const checkProposalInfo = async function(proposalId, _proposalInfo,_times,genesisProtocol) {
  let proposalInfo = await genesisProtocol.proposals(proposalId);
  // proposalInfo has the following structure
    //ProposalState state
  assert.equal(proposalInfo[0], _proposalInfo[0]);
    // uint winningVote
  assert.equal(proposalInfo[1], _proposalInfo[1]);
  //address proposer
  assert.equal(proposalInfo[2], _proposalInfo[2]);
    //uint currentBoostedVotePeriodLimit
  assert.equal(proposalInfo[3], _proposalInfo[3]);
  //uint daoBountyRemain
  assert.equal(proposalInfo[4], _proposalInfo[4]);
  //uint daoBounty
  assert.equal(proposalInfo[5], _proposalInfo[5]);
  //int totalStakes
  assert.equal(proposalInfo[6], _proposalInfo[6]);
  //int threshold
  assert.equal(proposalInfo[7], _proposalInfo[7]);
  //uint secondsFromTimeOutTillExecuteBoosted
  assert.equal(proposalInfo[8], _proposalInfo[8]);
  // - the mapping and array are simply not returned at all in the array
  checkProposalTimes(proposalId,_times,genesisProtocol);


};

const checkProposalTimes = async function(proposalId,_times,genesisProtocol) {
  //times[0] - submittedTime
  //times[1] - boostedPhaseTime
  //times[2] -preBoostedPhaseTime;
  let times =  await genesisProtocol.getProposalTimes(proposalId);
  assert.equal(times[0], _times[0]);
  assert.equal(times[1], _times[1]);
  assert.equal(times[2], _times[2]);

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
      let tx = await _testSetup.votableSchemeMock.proposeTest(numberOfChoices, _proposer);
      const proposalId = await helpers.getValueFromLogs(tx, '_proposalId');
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, "NewProposal");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._proposer, _proposer);
      assert.equal(proposalId,await helpers.getProposalId(tx,_testSetup.votableSchemeMock,"NewProposal"));
      assert.isOk(proposalId);
      return proposalId;
  };
const REAL_FBITS = 40;
const threshold = async function(_testSetup) {
      var t = await _testSetup.votableSchemeMock.threshold();
      return (t.shrn(REAL_FBITS).toNumber() + (t.maskn(REAL_FBITS)/Math.pow(2,REAL_FBITS))).toFixed(2);
};

const score = async function(_testSetup,proposalId) {
      var s = await _testSetup.votableSchemeMock.score(proposalId);
      return (s.shrn(REAL_FBITS).toNumber() + (s.maskn(REAL_FBITS)/Math.pow(2,REAL_FBITS))).toFixed(2);
};

const signatureType = 1;
function fixSignature (signature) {
  // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
  // signature malleability if version is 0/1
  // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) {
    v += 27;
  }
  const vHex = v.toString(16);
  return signature.slice(0, 130) + vHex;
}

// signs message in node (ganache auto-applies "Ethereum Signed Message" prefix)
async function signMessage (signer, messageHex = '0x') {
  return fixSignature(await web3.eth.sign(messageHex, signer));
}

const stake = async function(_testSetup,_proposalId,_vote,_amount,_staker,eventName = 'Stake') {
  var nonce =  (await _testSetup.votableSchemeMock.stakesNonce(_staker)).toString();
  var textMsg = "0x"+ethereumjs.soliditySHA3(
    ["address","bytes32","uint", "uint","uint"],
    [_testSetup.votableSchemeMock.address, _proposalId,_vote,_amount, nonce]
  ).toString("hex");
  //https://github.com/ethereum/wiki/wiki/JavaScript-API#web3ethsign
  let signature = await signMessage(_staker,textMsg);
  const encodeABI = await new web3.eth.Contract(_testSetup.votableSchemeMock.abi).methods.stakeWithSignature(_proposalId,_vote,_amount,nonce,signatureType,signature).encodeABI();
  var transaction;
  try {
    transaction = await _testSetup.stakingToken.approveAndCall(
      _testSetup.votableSchemeMock.address, _amount, encodeABI ,{from : _staker}
    );
    } catch (ex) {
      return "revert";
    }

  var stakeLog;
  await _testSetup.votableSchemeMock.getPastEvents(eventName,
          {_proposalId: _proposalId},
          {fromBlock: transaction.blockNumber}
       )
      .then(function(events){
          stakeLog = events;
      });

  return stakeLog;
};


contract('VotableScheme', accounts => {

  it("staking token address", async() => {
    var testSetup = await setup(accounts);
    assert.equal(await testSetup.votableSchemeMock.stakingToken(),testSetup.stakingToken.address);
  });

  it("Sanity checks", async function () {
      var testSetup = await setup(accounts);
      let winningVote = 2;
      let state = 3; //Qued

      //propose a vote
      const proposalId = await propose(testSetup);
      var submittedTime = (await  web3.eth.getBlock("latest")).timestamp;
      var currentBoostedVotePeriodLimit = 60;
      var daoBountyRemain = 15;

      await checkProposalInfo(proposalId, [
                                          state,
                                          winningVote,
                                          accounts[0],
                                          currentBoostedVotePeriodLimit,
                                          daoBountyRemain,
                                          0, //daoBounty
                                          0, //totalStake
                                          0,
                                          0,
                                        ],
                                        [submittedTime,0,0],
                                         testSetup.votableSchemeMock);
      await checkVotesStatus(proposalId, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],testSetup.votableSchemeMock);
      await checkIsVotable(proposalId, true,testSetup.votableSchemeMock);
      assert.equal(await testSetup.votableSchemeMock.getNumberOfChoices(proposalId),2);

      // now lets vote Option 2 with a minority reputation

      await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS);
      await testSetup.votableSchemeMock.cancelVote(proposalId);

      winningVote = 1;
      var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
      assert.equal(testSetup.reputationArray[0],proposalStatus[0]);
      assert.equal(0,proposalStatus[1]);
      await checkProposalInfo(proposalId, [
                                            state,
                                            winningVote,
                                            accounts[0],
                                            currentBoostedVotePeriodLimit,
                                            daoBountyRemain,
                                            0, //daoBounty
                                            0, //totalStake
                                            0,
                                            0
                                          ],
                                          [submittedTime,0,0],
                                          testSetup.votableSchemeMock);
      await checkVoteInfo(proposalId, accounts[0], [1, testSetup.reputationArray[0]],testSetup.votableSchemeMock);
      await checkVotesStatus(proposalId, [0, testSetup.reputationArray[0],0],testSetup.votableSchemeMock);
      await checkIsVotable(proposalId, true,testSetup.votableSchemeMock);
      // another minority reputation (Option 0):
      await testSetup.votableSchemeMock.vote(proposalId, 2,0,helpers.NULL_ADDRESS,{ from: accounts[1] });
      await checkVoteInfo(proposalId, accounts[1], [2, testSetup.reputationArray[1]],testSetup.votableSchemeMock);
      proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
      assert.equal(testSetup.reputationArray[0],proposalStatus[0]);
      assert.equal(testSetup.reputationArray[1],proposalStatus[1]);

      await checkProposalInfo(proposalId,[
                                            state,
                                            winningVote,
                                            accounts[0],
                                            currentBoostedVotePeriodLimit,
                                            daoBountyRemain,
                                            0, //daoBounty
                                            0, //totalStake
                                            0,
                                            0
                                          ],
                                          [submittedTime,0,0],
                                          testSetup.votableSchemeMock);

      await checkVotesStatus(proposalId, [0,testSetup.reputationArray[0], testSetup.reputationArray[1]],testSetup.votableSchemeMock);
      await checkIsVotable(proposalId, true,testSetup.votableSchemeMock);
  });

  it("check organization params validity", async function() {
    var queuedVoteRequiredPercentage = 0;
    var votersReputationLossRatio = 1;
    var thresholdConst = 2000;

    try {
      await setup(accounts,
                  helpers.NULL_ADDRESS,
                  queuedVoteRequiredPercentage,
                  60,//_queuedVotePeriodLimit
                  60,//_boostedVotePeriodLimit
                  0,//_preBoostedVotePeriodLimit
                  thresholdConst,//_thresholdConst
                  20,//_quietEndingPeriod
                  60,//_proposingRepReward
                  0,//_votersReputationLossRatio
                  1,//_minimumDaoBounty
                  1//_daoBountyConst
                );
      assert(false, " 50 <= queuedVoteRequiredPercentage <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

     queuedVoteRequiredPercentage = 101;


    try {
      await setup(accounts,helpers.NULL_ADDRESS,
        queuedVoteRequiredPercentage,
        60,//_queuedVotePeriodLimit
        60,//_boostedVotePeriodLimit
        0,//_preBoostedVotePeriodLimit
        thresholdConst,//_thresholdConst
        20,//_quietEndingPeriod
        60,//_proposingRepReward
        0,//_votersReputationLossRatio
        1,//_minimumDaoBounty
        1//_daoBountyConst
        );
      assert(false, " 50 <= queuedVoteRequiredPercentage <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    queuedVoteRequiredPercentage = 100;
    votersReputationLossRatio = 101;

    try {
      await setup(accounts,helpers.NULL_ADDRESS,
        queuedVoteRequiredPercentage,
        60,//_queuedVotePeriodLimit
        60,//_boostedVotePeriodLimit
        0,//_preBoostedVotePeriodLimit
        thresholdConst,//_thresholdConst
        20,//_quietEndingPeriod
        60,//_proposingRepReward
        votersReputationLossRatio,//_votersReputationLossRatio
        1,//_minimumDaoBounty
        1//_daoBountyConst
      );
      assert(false, " votersReputationLossRatio <=100    ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    votersReputationLossRatio = 100;
    thresholdConst = 0;

    try {
      await setup(accounts,helpers.NULL_ADDRESS,
        queuedVoteRequiredPercentage,
        60,//_queuedVotePeriodLimit
        60,//_boostedVotePeriodLimit
        0,//_preBoostedVotePeriodLimit
        thresholdConst,//_thresholdConst
        20,//_quietEndingPeriod
        60,//_proposingRepReward
        votersReputationLossRatio,//_votersReputationLossRatio
        1,//_minimumDaoBounty
        1//_daoBountyConst
        );
      assert(false, " thresholdConst > 0 ");
    } catch(error) {
      helpers.assertVMException(error);
    }
    thresholdConst = 2000;

    try {
      await setup(accounts,helpers.NULL_ADDRESS,
        queuedVoteRequiredPercentage,
        60,//_queuedVotePeriodLimit
        60,//_boostedVotePeriodLimit
        0,//_preBoostedVotePeriodLimit
        thresholdConst,//_thresholdConst
        20,//_quietEndingPeriod
        60,//_proposingRepReward
        votersReputationLossRatio,//_votersReputationLossRatio
        1,//_minimumDaoBounty
        0//_daoBountyConst
        );
      assert(false, " _daoBountyConst > 0 ");
    } catch(error) {
      helpers.assertVMException(error);
    }

    try {
      await setup(accounts,helpers.NULL_ADDRESS,
        queuedVoteRequiredPercentage,
        60,//_queuedVotePeriodLimit
        60,//_boostedVotePeriodLimit
        0,//_preBoostedVotePeriodLimit
        thresholdConst,//_thresholdConst
        20,//_quietEndingPeriod
        60,//_proposingRepReward
        votersReputationLossRatio,//_votersReputationLossRatio
        0,//_minimumDaoBounty
        1//_daoBountyConst
        );
      assert(false, " _minimumDaoBounty > 0 ");
    } catch(error) {
      helpers.assertVMException(error);
    }

  });

  it("log the VoteProposal event on voting ", async function() {
    var testSetup = await setup(accounts);


    const proposalId = await propose(testSetup);

    let voteTX = await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS);

    assert.equal(voteTX.logs.length, 1);
    assert.equal(voteTX.logs[0].event, "VoteProposal");
    assert.equal(voteTX.logs[0].args._proposalId, proposalId);
    assert.equal(voteTX.logs[0].args._voter, accounts[0]);
    assert.equal(voteTX.logs[0].args._vote, 1);
    assert.equal(voteTX.logs[0].args._reputation, testSetup.reputationArray[0]);
  });

  it("should log the ExecuteProposal event", async function() {
    var testSetup = await setup(accounts);


    const proposalId = await propose(testSetup);


    // now lets vote with a minority reputation
    await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS);

    //test that reputation change does not effect the snapshot
    var account2Rep =await testSetup.org.reputation.balanceOf(accounts[2]);
    assert.equal(account2Rep,testSetup.reputationArray[2]);
    await testSetup.votableSchemeMock.burnReputationTest(account2Rep,accounts[2],helpers.NULL_HASH);

    account2Rep =await testSetup.org.reputation.balanceOf(accounts[2]);
    assert.equal(account2Rep,0);

    // // the decisive vote is cast now and the proposal will be executed
    var tx = await testSetup.votableSchemeMock.vote(proposalId, 2,0,helpers.NULL_ADDRESS, { from: accounts[2] });
    assert.equal(tx.logs.length, 6);
    assert.equal(tx.logs[1].event, "ExecuteProposal");
    assert.equal(tx.logs[1].args._proposalId, proposalId);
    assert.equal(tx.logs[1].args._decision, 2);
    assert.equal(tx.logs[2].event, "GPExecuteProposal");
    assert.equal(tx.logs[2].args._executionState, 1); //QueBarCrossed
    assert.equal(tx.logs[5].event, "StateChange");
    assert.equal(tx.logs[5].args._proposalState, 2);
  });

  it("should log the ExecuteProposal event after time pass for preBoostedVotePeriodLimit (decision == 2 )", async function() {
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,2);

    const proposalId = await propose(testSetup);


    // now lets vote with a minority reputation
    await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS);
    await helpers.increaseTime(3);
    // the decisive vote is cast now and the proposal will be executed
    var tx = await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS, { from: accounts[2] });
    assert.equal(tx.logs.length, 5);
    assert.equal(tx.logs[0].event, "ExecuteProposal");
    assert.equal(tx.logs[0].args._proposalId, proposalId);
    assert.equal(tx.logs[0].args._decision, 2);
    assert.equal(tx.logs[1].event, "GPExecuteProposal");
    assert.equal(tx.logs[1].args._executionState, 2);//QueTimeOut
    assert.equal(tx.logs[2].event, "LogBytes32");
    assert.equal(tx.logs[2].args._msg, proposalId);
  });

  it("All options can be voted (1-2)", async function() {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    // Option 1
    await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS);
    await checkVoteInfo(proposalId, accounts[0], [1, testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkVotesStatus(proposalId, [0,testSetup.reputationArray[0], 0],testSetup.votableSchemeMock);
    await checkIsVotable(proposalId,true,testSetup.votableSchemeMock);


    testSetup = await setup(accounts);
    var tx = await testSetup.votableSchemeMock.proposeTest(2,accounts[0]);
    proposalId = await helpers.getValueFromLogs(tx, '_proposalId');

    // Option 2
    await testSetup.votableSchemeMock.vote(proposalId, 2,0,helpers.NULL_ADDRESS);
    await checkVoteInfo(proposalId, accounts[0], [2, testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkVotesStatus(proposalId, [0,0, testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkIsVotable(proposalId,true,testSetup.votableSchemeMock);
  });

  it("cannot re vote", async function() {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    await testSetup.votableSchemeMock.vote(proposalId, 2,0,helpers.NULL_ADDRESS);
    await checkVoteInfo(proposalId, accounts[0], [2, testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkVotesStatus(proposalId, [0,0,testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkIsVotable(proposalId,true,testSetup.votableSchemeMock);

    await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS);
    await checkVoteInfo(proposalId, accounts[0], [2, testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkVotesStatus(proposalId, [0,0,testSetup.reputationArray[0]],testSetup.votableSchemeMock);
    await checkIsVotable(proposalId,true,testSetup.votableSchemeMock);
  });

  it("Invalid percentage required( < 0 || > 100) shouldn't work", async function() {
    try {
      await setup(accounts,helpers.NULL_ADDRESS,150);
      assert(false, "setParameters was supposed to throw but didn't.");
    } catch(error) {
      helpers.assertVMException(error);
    }

    try {
      await setup(accounts,helpers.NULL_ADDRESS,-50);
      assert(false, "setParameters was supposed to throw but didn't.");
    } catch(error) {
      helpers.assertVMException(error);
    }
  });

  it("Proposal voting  shouldn't be able after proposal has been executed", async function () {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    // After this voting the proposal should be executed
    await testSetup.votableSchemeMock.vote(proposalId, 2,0,helpers.NULL_ADDRESS, {from: accounts[2]});

    // Should not be able to vote because the proposal has been executed
    try {
        await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS, { from: accounts[1] });
        assert(false, "vote was supposed to throw but didn't.");
    } catch (error) {
        helpers.assertVMException(error);
    }

  });

  it("cannot vote without reputation", async function () {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);
    // no one has voted yet at this point
    var submittedTime = (await  web3.eth.getBlock("latest")).timestamp;
    var state = 3;
    var winningVote = 2;
    var currentBoostedVotePeriodLimit = 60;
    var daoBountyRemain = 15;


    await checkProposalInfo(proposalId, [
                                          state,
                                          winningVote,
                                          accounts[0],
                                          currentBoostedVotePeriodLimit,
                                          daoBountyRemain,
                                          0, //daoBounty
                                          0, //totalStake
                                          0,
                                          0
                                          ],
                                          [submittedTime,0,0],
                                          testSetup.votableSchemeMock);
    // lets try to vote by the owner on the behalf of non-existent voters(they do exist but they aren't registered to the reputation system).
    try {
      await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS ,{ from: accounts[3] });
      assert(false, 'cannot vote without reputation');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
    // everything should be 0
    await checkVotesStatus(proposalId, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],testSetup.votableSchemeMock);

  });

  it('Test voteWithSpecifiedAmounts - More reputation than I own, negative reputation, etc..', async function () {
      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);


    // Vote with the reputation the I own - should work
    let tx = await testSetup.votableSchemeMock.vote(proposalId, 1, testSetup.reputationArray[0] / 10, helpers.NULL_ADDRESS);

    var repVoted = await helpers.getValueFromLogs(tx, "_reputation");

    assert.equal(repVoted, testSetup.reputationArray[0] / 10, 'Should vote with specified amount');

    // Vote with more reputation that i own - exception should be raised
    try {
      await testSetup.votableSchemeMock.vote(proposalId, 1, (testSetup.reputationArray[1] + 1), helpers.NULL_ADDRESS,{from:accounts[1]});
      assert(false, 'Not enough reputation - voting shouldn\'t work');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // Vote with a very big number - exception should be raised

    let bigNum = ((new BigNumber(2)).toPower(254)).toString(10);
    try {
      await testSetup.votableSchemeMock.vote(proposalId, 1, bigNum, helpers.NULL_ADDRESS);
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
      await testSetup.votableSchemeMock.internalVote(proposalId, accounts[0], 1, testSetup.reputationArray[0]);
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
      await testSetup.votableSchemeMock.vote(helpers.NULL_HASH, 1,0,helpers.NULL_ADDRESS, {from: accounts[0]});
      assert(false, 'Invalid proposal ID has been delivered');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // Lets try to call voteWithSpecifiedAmounts with invalid proposal id
    try {
      await testSetup.votableSchemeMock.vote(helpers.NULL_HASH, 1, 1,helpers.NULL_ADDRESS);
      assert(false, 'Invalid proposal ID has been delivered');
    } catch (ex) {
      helpers.assertVMException(ex);
    }

    // Lets try to call execute with invalid proposal id
    try {
      await testSetup.votableSchemeMock.execute(helpers.NULL_HASH);
      assert(false, 'Invalid proposal ID has been delivered');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it("stake with approveAndCall log", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);
    var tx = await stake(testSetup,proposalId,1,10,accounts[0]);
    assert.equal(await testSetup.votableSchemeMock.voteStake(proposalId,1),10);
    assert.equal(await testSetup.votableSchemeMock.isAbstainAllow(),false);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
  });

  it("stake more than allowed.", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    let maxTotalStakeAllowed = ((new BigNumber(2)).toPower(128)).sub(15);

    assert.equal(await stake(testSetup,proposalId,1,maxTotalStakeAllowed.add(1).toString(10),accounts[0]),"revert");

    var tx = await stake(testSetup,proposalId,1,maxTotalStakeAllowed.toString(10),accounts[0]);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, maxTotalStakeAllowed.toString(10));
  });

  it("stake log", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    await testSetup.stakingToken.approve(testSetup.votableSchemeMock.address,10);

    var tx = await testSetup.votableSchemeMock.stake(proposalId,1,10);
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "Stake");
    assert.equal(tx.logs[0].args._staker, accounts[0]);
    assert.equal(tx.logs[0].args._vote, 1);
    assert.equal(tx.logs[0].args._amount, 10);
  });

  it("check nonce ", async () => {
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000);
    var proposalId = await propose(testSetup);

    let staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],0);
    assert.equal(staker[1],0);

    var tx = await stake(testSetup,proposalId,1,10,accounts[0]);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
    staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],10);
    var nonce =  await testSetup.votableSchemeMock.stakesNonce(accounts[0]);
    nonce--;

    var textMsg = "0x"+ethereumjs.soliditySHA3(
        ["address","bytes32","uint", "uint","uint"],
        [testSetup.votableSchemeMock.address, proposalId,1,10, nonce.toString()]
      ).toString("hex");
    const signature = await signMessage(accounts[0],textMsg);
    const encodeABI = await new web3.eth.Contract(testSetup.votableSchemeMock.abi).methods.stakeWithSignature(proposalId,1,10,nonce.toString(),signatureType,signature).encodeABI();
    try {
     await testSetup.stakingToken.approveAndCall(
        testSetup.votableSchemeMock.address, 10, encodeABI ,{from : accounts[0]}
      );
      assert(false, 'stake should fail with the same nonce');
    } catch (ex) {
      //helpers.assertVMException(ex);
    }
  });

  it("check stake with wrong signature ", async () => {

    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000);

    var proposalId = await propose(testSetup);

    let staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],0);
    assert.equal(staker[1],0);
    var nonce =  (await testSetup.votableSchemeMock.stakesNonce(accounts[0])).toString();
    var textMsg = "0x"+ethereumjs.soliditySHA3(
        ["address","bytes32","uint", "uint","uint"],
        [testSetup.votableSchemeMock.address, proposalId,1,10, nonce]
      ).toString("hex");
    const signature = await signMessage(accounts[0], textMsg);
    proposalId = "0x1234"; //change proposalId
    const encodeABI = await new web3.eth.Contract(testSetup.votableSchemeMock.abi).methods.stakeWithSignature(proposalId,1,10,nonce,signatureType,signature).encodeABI();
    try {
     await testSetup.stakingToken.approveAndCall(
        testSetup.votableSchemeMock.address, 10, encodeABI ,{from : accounts[0]}
      );
      assert(false, 'stake should fail due to wrong signature');
    } catch (ex) {
      //helpers.assertVMException(ex);
    }
  });


  it("multiple stakes ", async () => {

    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000);

    var proposalId = await propose(testSetup);


    let staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],0);
    assert.equal(staker[1],0);

    var tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
    staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],10);

    //add more stake on the same vote
    tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx[0].event, "Stake");
    assert.equal(tx[0].args._staker, accounts[0]);
    assert.equal(tx[0].args._vote, 1);
    assert.equal(tx[0].args._amount, 10);
    staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],20);
    //try to stake with different vote as before
    tx = await stake(testSetup,proposalId,2,10,accounts[0]);
    staker = await testSetup.votableSchemeMock.getStaker(proposalId,accounts[0]);
    assert.equal(staker[0],1);
    assert.equal(staker[1],20);

    let proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[6],20); //totalStakes + dao downstake
  });

  it("stake without approval - fail", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


      try {
        await testSetup.votableSchemeMock.stake(proposalId,2,10);
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
      //helpers.assertVMException(ex);
    }

  });

  it("stake on boosted proposal is not allowed", async () => {

    var testSetup = await setup(accounts);
    var proposalId = await propose(testSetup);
    //shift proposal to boosted phase
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],3);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],boostedState);  //state boosted
    //S = (S+) /(S-)
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    var score = proposalStatus[2]/proposalStatus[3];
    assert.equal(score,100/15);
    //try to stake on boosted proposal should fail
    var tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx.length, 0);
  });

  it("absolute majority on pre boosting proposal", async () => {
    var thresholdConst = 1700; //1.7
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,60,thresholdConst,0,60,10,2);
    var proposalId = await propose(testSetup);
    //shift proposal to boosted phase
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],3);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,30,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],30); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);  //state preboosted
    var tx = await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:accounts[2]});
    assert.equal(tx.logs[2].event, "GPExecuteProposal");
    assert.equal(tx.logs[2].args._executionState, 3); //PreBoostedBarCrossed

  });

  it("boost proposal", async () => {
    var thresholdConst = 1700; //1.7
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,thresholdConst,0,60,10,2);
    var proposalId = await propose(testSetup);
    //shift proposal to boosted phase
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],3);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,30,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],30); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],boostedState);  //state boosted
    //S = (S+) /(S-)
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    var score = proposalStatus[2]/proposalStatus[3];
    assert.equal(score,30/2);
    //try to boost another proposal - score(confidence) should be higher than 1.7
    proposalId = await propose(testSetup);
    proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    assert.equal(proposalStatus[3].toNumber(),20);
    await stake(testSetup,proposalId,YES,34,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    //not boosted yet because 34/20 = 1.7
    assert.equal(proposalInfo[proposalStateIndex],3);
    // upstake with 1 should be enough to boost
    await stake(testSetup,proposalId,YES,1,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    assert.equal(proposalStatus[3].toNumber(),20);
    assert.equal(proposalStatus[2].toNumber(),35);
    assert.equal(proposalInfo[proposalStateIndex],boostedState);
  });



  it("stake on boosted dual proposal is not allowed", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    //shift proposal to boosted phase
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],3);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);

    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted

    //S* POW(R/totalR)
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    var score = proposalStatus[2]/proposalStatus[3];
    assert.equal(score,100/15);

    //try to stake on boosted proposal should fail
    var tx = await stake(testSetup,proposalId,YES,10,accounts[0]);
    assert.equal(tx.length, 0);
  });

  it("shouldBoost ", async () => {
    var testSetup = await setup(accounts);
    var proposalId = await propose(testSetup);
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    var score = proposalStatus[2]/proposalStatus[3];
    assert.equal(score,0);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted
    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),true);
    proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    score = proposalStatus[2]/proposalStatus[3];
    assert.equal(score,100/15);

  });

  it("average boosted downstake ", async () => {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);

    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);

    await stake(testSetup,proposalId,YES,100,accounts[0]);

    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted
    assert.equal(await testSetup.votableSchemeMock.averagesDownstakesOfBoosted(),15);

    //BOOST another proposal
    proposalId = await propose(testSetup);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    assert.equal(proposalStatus[3],150);//downstake
    await stake(testSetup,proposalId,YES,web3.utils.toWei("3000"),accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted
    assert.equal(await testSetup.votableSchemeMock.averagesDownstakesOfBoosted(),Math.floor((15+150)/2));
    //expiere proposal by getting absolute majority
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:accounts[2]});
    assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),1);
    assert.equal(await testSetup.votableSchemeMock.averagesDownstakesOfBoosted(),Math.floor((82*2-150)/1));

  });

  it("average boosted downstake with booster proposal == 0 ", async () => {
    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);

    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    var score = proposalStatus[2]/proposalStatus[3];
    assert.equal(score,0);

    await stake(testSetup,proposalId,YES,100,accounts[0]);

    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted
    assert.equal(await testSetup.votableSchemeMock.averagesDownstakesOfBoosted(),15);

    //expiere proposal by getting absolute majority
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:accounts[2]});
    assert.equal(await testSetup.votableSchemeMock.averagesDownstakesOfBoosted(),0);
  });


  it("stake on none votable phase should revert ", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);

    await testSetup.stakingToken.approve(testSetup.votableSchemeMock.address,10);
    //vote with majority. state is executed
    await testSetup.votableSchemeMock.vote(proposalId, 1,0,helpers.NULL_ADDRESS, { from: accounts[2] });

    try {
      await stake(testSetup,proposalId,1,0,accounts[0]);
      assert(false, 'stake on executed phase should revert');
    } catch (ex) {
      //helpers.assertVMException(ex);
    }

  });

  it("redeem ", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    var accounts0Balance = await testSetup.stakingToken.balanceOf(accounts[0]);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    await helpers.increaseTime(61);
    await testSetup.votableSchemeMock.execute(proposalId);
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[5],15);
    var redeemRewards = await testSetup.votableSchemeMock.redeem.call(proposalId,accounts[0]);
    var redeemToken = redeemRewards[0].toNumber();
    assert.equal(redeemToken,((100+15-15)*100)/100);
    assert.equal(await testSetup.stakingToken.balanceOf(accounts[0]),accounts0Balance-100);
    assert.equal(proposalInfo[6],100);
    var tx = await testSetup.votableSchemeMock.redeem(proposalId,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[6],0);
    assert.equal(tx.logs.length,2);
    assert.equal(tx.logs[0].event, "Redeem");
    assert.equal(tx.logs[0].args._proposalId, proposalId);
    assert.equal(tx.logs[0].args._beneficiary, accounts[0]);
    assert.equal(tx.logs[0].args._amount, redeemToken);
    assert.equal(accounts0Balance.eq(await testSetup.stakingToken.balanceOf(accounts[0])),true);
    assert.equal(await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address),0);
  });

  it("redeem without execution should revert", async () => {

    var testSetup = await setup(accounts);

    var proposalId = await propose(testSetup);


    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    await testSetup.votableSchemeMock.execute(proposalId);
    try {
      await  testSetup.votableSchemeMock.redeem(proposalId,accounts[0]);
      assert(false, 'redeem before execution should revert');
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

    it("dynamic threshold ", async () => {
      var testSetup = await setup(accounts);

      var thresholdConst = 2000/1000;


      var proposalId = await propose(testSetup);

      assert.equal(await threshold(testSetup),1);

      assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),0);

      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      assert.equal(await testSetup.votableSchemeMock.state(proposalId),boostedState);
      assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),1);
      assert.equal(await threshold(testSetup),thresholdConst);

      //set up another proposal
      proposalId = await propose(testSetup);
      //boost it
      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
      await stake(testSetup,proposalId,YES,web3.utils.toWei("1600"),accounts[0]);
      assert.equal(await testSetup.votableSchemeMock.state(proposalId),boostedState);

      assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),2);
      assert.equal(await threshold(testSetup),thresholdConst*thresholdConst);

      //execute
      await helpers.increaseTime(61);
      await testSetup.votableSchemeMock.execute(proposalId);
      assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),1);
      assert.equal(await threshold(testSetup),thresholdConst);
    });

    it("reputation flow ", async () => {
      var voterY = accounts[0];
      var voterN = accounts[1];
      var proposer = accounts[2];
      var staker = accounts[2];


      var votersReputationLossRatio=20;
      var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,0,60,votersReputationLossRatio,15,10);
      var totalRepSupply = await testSetup.org.reputation.totalSupply();
      var proposalId = await propose(testSetup,proposer);

      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:voterY});
      await testSetup.votableSchemeMock.vote(proposalId,NO,0,helpers.NULL_ADDRESS,{from:voterN});
      assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
      await testSetup.stakingToken.transfer(staker,500,{from:accounts[0]});
      var balanceOfVoterY = await testSetup.stakingToken.balanceOf(voterY);
      await stake(testSetup,proposalId,YES,100,staker);
      await helpers.increaseTime(61);
      await testSetup.votableSchemeMock.execute(proposalId);
      var redeemRewards = await testSetup.votableSchemeMock.redeem.call(proposalId,voterY);
      var redeemToken = redeemRewards[0].toNumber();
      var redeemReputation = redeemRewards[1].toNumber() + redeemRewards[2].toNumber();
      var repVoterY = testSetup.reputationArray[0];
      var repVoterN = testSetup.reputationArray[1];
      var lostReputation = (repVoterN * votersReputationLossRatio)/100;
      var voterYRepDeposit = (repVoterY * votersReputationLossRatio)/100;
      assert.equal(redeemReputation,Math.round(voterYRepDeposit + (repVoterY *lostReputation)/ repVoterY));
      assert.equal(redeemToken,0);
      var tx = await testSetup.votableSchemeMock.redeem(proposalId,voterY);
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "RedeemReputation");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, voterY);
      assert.equal(tx.logs[0].args._amount, redeemReputation);
      assert.equal(balanceOfVoterY.eq(await testSetup.stakingToken.balanceOf(voterY)),true);
      assert.equal(await testSetup.org.reputation.balanceOf(voterY),Math.round(repVoterY+(repVoterY *lostReputation)/ repVoterY));
      //check rep sum zero
      assert.equal(totalRepSupply.toNumber(), (await testSetup.org.reputation.totalSupply()).toNumber());
    });

    it("reputation flow for unsuccessful voting", async () => {
      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);

      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
      assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
      var balanceOfAccounts0 = await testSetup.stakingToken.balanceOf(accounts[0]);
      await helpers.increaseTime(61);
      await testSetup.votableSchemeMock.execute(proposalId);
      var redeemRewards = await testSetup.votableSchemeMock.redeem.call(proposalId,accounts[0]);
      var totalRep = redeemRewards[1].toNumber() + redeemRewards[2].toNumber();
      var tx = await testSetup.votableSchemeMock.redeem(proposalId,accounts[0]);
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, "RedeemReputation");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, accounts[0]);
      //var totalRep =  rep4Stake.toNumber() + rep4Vote.toNumber() + rep4Propose.toNumber();
      assert.equal(tx.logs[0].args._amount, totalRep);
      assert.equal(balanceOfAccounts0.eq(await testSetup.stakingToken.balanceOf(accounts[0])),true);
      var loss = (10*testSetup.reputationArray[0])/100;  //votersReputationLossRatio
      assert.equal(await testSetup.org.reputation.balanceOf(accounts[0]),testSetup.reputationArray[0] + totalRep - loss);
    });

    it("quite window ", async () => {
      var quietEndingPeriod = 20;

      var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,quietEndingPeriod,60,10,15,10);

      var proposalId = await propose(testSetup);


      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:accounts[1]});
      assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],boostedState);//boosted

      await helpers.increaseTime(50); //get into the quite period
      assert.equal(await threshold(testSetup),2);

      var tx = await testSetup.votableSchemeMock.vote(proposalId,NO,0,helpers.NULL_ADDRESS,{from:accounts[0]}); //change winning vote

      assert.equal(tx.logs[0].event, "StateChange");
      assert.equal(tx.logs[0].args._proposalState, 6);

      assert.equal(await threshold(testSetup),2);

      proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],6);//quietEndingPeriod -still not execute
      await helpers.increaseTime(15); //increase time

      await testSetup.votableSchemeMock.execute(proposalId);

      proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],6);//boosted -still not execute
      await helpers.increaseTime(10); //increase time

      assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),1);

      await testSetup.votableSchemeMock.execute(proposalId);

      assert.equal(await threshold(testSetup),1);

      assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),0);

      proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],2);//executed
    });

    it("quite window with tie ", async () => {
      var quietEndingPeriod = 20;

      var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,quietEndingPeriod,60,10,15,10);

      var proposalId = await propose(testSetup);
      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:accounts[1]});
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      await helpers.increaseTime(50); //get into the quite period
      var yesVotes = await testSetup.votableSchemeMock.voteStatus(proposalId,YES);
      await testSetup.votableSchemeMock.vote(proposalId,NO,yesVotes,helpers.NULL_ADDRESS,{from:accounts[2]}); //change winning vote by create a tie.
      await helpers.increaseTime(15); //increase time
      await testSetup.votableSchemeMock.execute(proposalId);
      var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],6);//boosted -still not execute
      await helpers.increaseTime(10); //increase time
      await testSetup.votableSchemeMock.execute(proposalId);
      proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[proposalStateIndex],2);//executed
      assert.equal(await testSetup.votableSchemeMock.winningVote(proposalId),NO);
    });

    it("scoreThresholdParams and getProposalOrganization", async () => {

      var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,0,60,10,15,10);

      await propose(testSetup);
    });

    it('getAllowedRangeOfChoices', async function () {
      var testSetup = await setup(accounts);
      let allowedRange = await testSetup.votableSchemeMock.getAllowedRangeOfChoices();

      assert.equal(allowedRange[0],1);
      assert.equal(allowedRange[1],2);
    });

    it("redeem dao bounty", async () => {

      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);
      await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
      assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);
      await stake(testSetup,proposalId,YES,100,accounts[0]);
      await helpers.increaseTime(61);
      await testSetup.votableSchemeMock.execute(proposalId);
      var redeemRewards = await testSetup.votableSchemeMock.redeemDaoBounty.call(proposalId,accounts[0]);
      var stakerRedeemAmountBounty = redeemRewards[0];
      var potentialAmount = redeemRewards[1];
      var proposalInfo =  await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(potentialAmount.eq(proposalInfo[5]),true);
      assert.equal(stakerRedeemAmountBounty.eq(proposalInfo[5]),true);

      var balanceOfAccounts0 = await testSetup.stakingToken.balanceOf(accounts[0]);
      tx = await testSetup.votableSchemeMock.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,1);
      assert.equal(tx.logs[0].event, "RedeemDaoBounty");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, accounts[0]);
      assert.equal(tx.logs[0].args._amount, potentialAmount.toNumber());
      var bafter = await testSetup.stakingToken.balanceOf(accounts[0]);
      assert.equal(bafter.sub(balanceOfAccounts0) ,15);
      tx = await testSetup.votableSchemeMock.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,0);

    });

    it("redeem dao bounty for unsuccessful proposal", async () => {

      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);
      await stake(testSetup,proposalId,NO,100,accounts[0]);
      await testSetup.votableSchemeMock.vote(proposalId,NO,0,helpers.NULL_ADDRESS,{from:accounts[2]});
      var redeemRewards = await testSetup.votableSchemeMock.redeemDaoBounty.call(proposalId,accounts[0]);
      var stakerRedeemAmountBaunty = redeemRewards[0];
      assert.equal(stakerRedeemAmountBaunty,0);
      var balanceOfAccounts0 = await testSetup.stakingToken.balanceOf(accounts[0]);

      //send tokens to org avatar
      var tx = await testSetup.votableSchemeMock.redeemDaoBounty(proposalId,accounts[0]);
      assert.equal(tx.logs.length,0);
      assert.equal(balanceOfAccounts0.eq(await testSetup.stakingToken.balanceOf(accounts[0])),true);

    });

    it("vote on behalf ", async function() {
      var voteOnBehalf = accounts[1];
      var testSetup = await setup(accounts,voteOnBehalf);
      const proposalId = await propose(testSetup);
      try {
        await testSetup.votableSchemeMock.vote(proposalId, 1,0,accounts[2],{from:accounts[0]});
        assert(false, 'can vote only from voteOnBehalf address');
      } catch (ex) {
        helpers.assertVMException(ex);
      }

      let voteTX = await testSetup.votableSchemeMock.vote(proposalId, 1,0,accounts[2],{from:voteOnBehalf});

      assert.equal(voteTX.logs.length, 6);
      assert.equal(voteTX.logs[0].event, "VoteProposal");
      assert.equal(voteTX.logs[0].args._proposalId, proposalId);
      assert.equal(voteTX.logs[0].args._voter, accounts[2]);
      assert.equal(voteTX.logs[0].args._vote, 1);
      assert.equal(voteTX.logs[0].args._reputation, testSetup.reputationArray[2]);
    });

    it("quite window double toggling direction", async () => {
    var quietEndingPeriod = 60;

    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,quietEndingPeriod,60,10,15,10);

    var proposalId = await propose(testSetup);

    //boost proposal
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],boostedState);//boosted
    //vote YES to get in quite window period
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS,{from:accounts[0]}); //change winning vote
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],6);//quiteEndperiod
    await helpers.increaseTime(10); //increase time
    assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),1);
    //vote NO to toggle direction again and extend the quite end period
    await testSetup.votableSchemeMock.vote(proposalId,NO,0,helpers.NULL_ADDRESS,{from:accounts[2]}); //change winning vote and execute
    assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),0);
    //increase time after the proposal expiration
    await helpers.increaseTime(61); //increase time
    assert.equal(await threshold(testSetup),1);

  });

  it("set organization ", async () => {
      var testSetup = await setup(accounts,
                                 helpers.NULL_ADDRESS,
                                 50,
                                 60,
                                 60,
                                 0,
                                 2000,
                                 0,
                                 60,
                                 1,
                                 15,
                                 10,
                                 0,
                                 accounts[1]);
      try {
        await testSetup.votableSchemeMock.propose(2,accounts[1]);
        assert(false, 'cannot propose from not authorized account');
      } catch (ex) {
        //helpers.assertVMException(ex);
      }

      var tx = await testSetup.votableSchemeMock.proposeTest(2,accounts[1],{from:accounts[1]});
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, "NewProposal");
      assert.equal(tx.logs[0].args._organization,testSetup.votableSchemeMock.address);
      assert.equal(tx.logs[0].args._proposer,accounts[1]);

      var proposalId = await helpers.getValueFromLogs(tx, '_proposalId');
      await testSetup.votableSchemeMock.proposals(proposalId);
      tx = await testSetup.votableSchemeMock.proposeTest(2,accounts[1],{from : accounts[1]});
      assert.equal(tx.logs.length, 2);
      assert.equal(tx.logs[0].event, "NewProposal");
      assert.equal(tx.logs[0].args._proposer,accounts[1]);
  });

  it("organization can redeem its winning stakes ", async () => {
      var testSetup = await setup(accounts);

      var proposalId = await propose(testSetup);


      await testSetup.votableSchemeMock.vote(proposalId,NO,0,helpers.NULL_ADDRESS);
      assert.equal(await testSetup.votableSchemeMock.shouldBoost(proposalId),false);

      await stake(testSetup,proposalId,YES,100,accounts[1]);
      await helpers.increaseTime(61);

      await testSetup.votableSchemeMock.execute(proposalId);
      var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[5],15);

      var redeemRewards = await testSetup.votableSchemeMock.redeem.call(proposalId,testSetup.votableSchemeMock.address);
      var redeemToken = redeemRewards[0].toNumber();
      var tx = await testSetup.votableSchemeMock.redeem(proposalId,testSetup.votableSchemeMock.address);
      proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
      assert.equal(proposalInfo[8],0);
      assert.equal(tx.logs.length,1);
      assert.equal(tx.logs[0].event, "Redeem");
      assert.equal(tx.logs[0].args._proposalId, proposalId);
      assert.equal(tx.logs[0].args._beneficiary, testSetup.votableSchemeMock.address);
      assert.equal(tx.logs[0].args._amount, redeemToken);
      assert.equal((await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address)).toNumber(), 100);
      //cannot redeem twice
      tx = await testSetup.votableSchemeMock.redeem(proposalId,testSetup.votableSchemeMock.address);
      assert.equal(tx.logs.length,0);

  });

  it("prepare for boost  ", async () => {

    var preBoostedVotePeriodLimit = 60;
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,preBoostedVotePeriodLimit);
    var proposalId = await propose(testSetup);

    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);

    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    await stake(testSetup,proposalId,YES,100,accounts[0]);

    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes

    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //state pre boosted

    await helpers.increaseTime(preBoostedVotePeriodLimit+1);
    await testSetup.votableSchemeMock.execute(proposalId);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted

  });

  it("from prepare for boost back to que", async () => {

    var preBoostedVotePeriodLimit = 60;
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,preBoostedVotePeriodLimit);
    var proposalId = await propose(testSetup);

    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);

    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    await stake(testSetup,proposalId,YES,100,accounts[0]);

    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes

    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //state pre boosted
    assert.equal(proposalInfo[7],Math.pow(2,REAL_FBITS));//check proposal own threshold
    await stake(testSetup,proposalId,NO,200,accounts[1]); //downstake ...
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],3);   //state back to q

  });

  it("from prepare for boost back to que after pre boosted time passed", async () => {

    var preBoostedVotePeriodLimit = 60;
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,1000,60,preBoostedVotePeriodLimit);
    var proposalId = await propose(testSetup);

    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);

    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);

    await stake(testSetup,proposalId,YES,50,accounts[0]);

    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],50); //totalStakes

    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //state pre boosted
    assert.equal(proposalInfo[7],Math.pow(2,REAL_FBITS));//check proposal own threshold

    //boost 2 proposals
    let proposalIdTemp;
    for (var i=0;i<2;i++) {
        proposalIdTemp = await propose(testSetup);//boost a proposal
        await testSetup.votableSchemeMock.vote(proposalIdTemp,YES,0,helpers.NULL_ADDRESS);
        await stake(testSetup,proposalIdTemp,YES,web3.utils.toWei("1500"),accounts[0]);
        await helpers.increaseTime(preBoostedVotePeriodLimit+1);
        await testSetup.votableSchemeMock.execute(proposalIdTemp);
    }

    assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),2);
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState); //state back to q
    await stake(testSetup,proposalId,NO,200,accounts[1]); //downstake ...
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],3);   //state back to q
  });

  it("prepare for boost check high from the minimum threshold", async () => {

    var preBoostedVotePeriodLimit = 60;
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,600,60,preBoostedVotePeriodLimit,3000);
    var proposalId = await propose(testSetup);
    var proposalId2 = await propose(testSetup);//boost a proposal
    await testSetup.votableSchemeMock.vote(proposalId2,YES,0,helpers.NULL_ADDRESS);
    await stake(testSetup,proposalId2,YES,web3.utils.toWei("1500"),accounts[0]);
    await helpers.increaseTime(preBoostedVotePeriodLimit+1);
    await testSetup.votableSchemeMock.execute(proposalId2);
    assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),1);
    assert.equal(await threshold(testSetup),3);

    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    await stake(testSetup,proposalId,YES,100,accounts[0]);

    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],100); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //state pre boosted
    assert.equal(proposalInfo[7],3*Math.pow(2,REAL_FBITS));//check proposal own threshold

    assert.equal(await score(testSetup,proposalId),(100/15).toFixed(2));
    assert.equal(await threshold(testSetup),3);
    //now decrease threshold
    await testSetup.votableSchemeMock.vote(proposalId2,YES,0,helpers.NULL_ADDRESS,{from:accounts[2]});
    assert.equal(await threshold(testSetup),1);
    var tx = await stake(testSetup,proposalId,NO,35,accounts[1],"ConfidenceLevelChange"); //downstake 35 to make score =2.
    assert.equal(tx[0].event, "ConfidenceLevelChange");
    assert.equal(tx[0].args._proposalId, proposalId);
    assert.equal(tx[0].args._confidenceThreshold, Math.pow(2,REAL_FBITS));

    assert.equal(await score(testSetup,proposalId),2);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //no change is state
  });


  it("prepare for boost and boost with a new threshold  ", async () => {

    var preBoostedVotePeriodLimit = 60;
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,preBoostedVotePeriodLimit);
    var proposalId = await propose(testSetup);
    var proposalId2 = await propose(testSetup);
    await stake(testSetup, proposalId2, YES, web3.utils.toWei("1500"),accounts[0]);
    var proposalId3 = await propose(testSetup);
    await stake(testSetup, proposalId3, YES, web3.utils.toWei("1500"),accounts[0]);
    var proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId2);
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //state pre boosted
    await helpers.increaseTime(preBoostedVotePeriodLimit/2); //proposalId2 half pre boosted

    //preboost proposalId
    await stake(testSetup,proposalId,YES,60,accounts[0]);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalTotalStakesIndex],60); //totalStakes
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //state pre boosted
    await helpers.increaseTime(preBoostedVotePeriodLimit/2 +1 );
    await testSetup.votableSchemeMock.execute(proposalId2);
    await testSetup.votableSchemeMock.execute(proposalId3);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId2);
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //state boosted

    //proposalId2 is now boosted
    assert.equal(await testSetup.votableSchemeMock.orgBoostedProposalsCnt(),2);
    //try to execute proposalId
    await testSetup.votableSchemeMock.execute(proposalId);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],preBoostedState);   //still preBoosted

    assert.equal(await threshold(testSetup),4);

    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    assert.equal(proposalStatus[2],60);
    assert.equal(proposalStatus[3],15);

    await stake(testSetup,proposalId,YES,web3.utils.toWei("3000"),accounts[0]);
    await helpers.increaseTime(preBoostedVotePeriodLimit/2 +1 );
    await testSetup.votableSchemeMock.execute(proposalId);
    proposalInfo = await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo[proposalStateIndex],boostedState);   //now it is boosted

  });

  it("executeBoosted", async () => {

    var minimumDaoBounty = await web3.utils.toWei("0.1");
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,0,60,1,minimumDaoBounty,10);

    var proposalId = await propose(testSetup);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    var userStake = await web3.utils.toWei("1");
    await stake(testSetup,proposalId,YES,userStake,accounts[0]);
    try {
         await testSetup.votableSchemeMock.executeBoosted(proposalId);
         assert(false, 'cannot call executeBoosted if not expired');
       } catch (ex) {
         helpers.assertVMException(ex);
       }
    var addTime =15;
    await helpers.increaseTime(60+addTime);
    var tx = await testSetup.votableSchemeMock.executeBoosted(proposalId);
    var secondsFromTimeOutTillExecuteBoosted =
    (await testSetup.votableSchemeMock.proposals(proposalId)).secondsFromTimeOutTillExecuteBoosted;
   // please note that due to the need of calling two separate ganache methods and rpc calls overhead
   // it's hard to increase time precisely to a target point
    assert.equal(((secondsFromTimeOutTillExecuteBoosted.toNumber() === addTime)||
                  (secondsFromTimeOutTillExecuteBoosted.toNumber() === (addTime+1)) ||
                  (secondsFromTimeOutTillExecuteBoosted.toNumber() === (addTime+2))),true);
    var expectedBounty = Math.floor((((secondsFromTimeOutTillExecuteBoosted/15)/10)/100) * userStake);
    assert.equal(tx.logs[5].event, "ExpirationCallBounty");
    assert.equal(tx.logs[5].args._proposalId, proposalId);
    assert.equal(tx.logs[5].args._beneficiary, accounts[0]);
    assert.equal(tx.logs[5].args._amount.toString(), expectedBounty);
    var redeemRewards = await testSetup.votableSchemeMock.redeem.call(proposalId,accounts[0]);
    var redeemToken = redeemRewards[0];
    var daoBounty =  new web3.utils.BN(minimumDaoBounty);
    var totalStakes = (new web3.utils.BN(userStake)).add(daoBounty);
    var totalStakesLeftAfterCallBounty = totalStakes.sub(new web3.utils.BN(expectedBounty));
    var _totalStakes = totalStakesLeftAfterCallBounty - daoBounty;
    if (secondsFromTimeOutTillExecuteBoosted.toNumber() === addTime) {
        //increase time accurate
        assert.equal(redeemToken.toString(),_totalStakes.toString());
    } else {
        assert.equal(redeemToken.toString().substring(0, 15),_totalStakes.toString().substring(0, 15));
    }

    await testSetup.votableSchemeMock.redeem(proposalId,accounts[0]);
    var proposalInfo =  await testSetup.votableSchemeMock.proposals(proposalId);
    assert.equal(proposalInfo.totalStakes,0);
    assert.equal(await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address),0);
  });

  it("executeBoosted max (1500)", async () => {

    var testSetup = await setup(accounts);
    var proposalId = await propose(testSetup);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    var userStake = web3.utils.toWei("1");
    await stake(testSetup,proposalId,YES,userStake,accounts[0]);
    var addTime =2000 ;
    await helpers.increaseTime(60+addTime);
    var tx = await testSetup.votableSchemeMock.executeBoosted(proposalId);
    var expectedBounty = 1500*userStake/15000;
    assert.equal(tx.logs[5].event, "ExpirationCallBounty");
    assert.equal(tx.logs[5].args._proposalId, proposalId);
    assert.equal(tx.logs[5].args._beneficiary, accounts[0]);
    assert.equal(tx.logs[5].args._amount, expectedBounty );
    var genesisProtocolBalance = await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address);
    assert.equal(genesisProtocolBalance.eq((new web3.utils.BN(userStake)).sub(new web3.utils.BN(expectedBounty.toString()))),true);
    let daoBounty = await testSetup.votableSchemeMock.redeemDaoBounty.call(proposalId,accounts[0]);
    assert.equal(daoBounty[1],15);
  });

  it("executeBoosted check NO stake", async () => {

    var minimumDaoBounty = web3.utils.toWei("1");
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,0,60,1,minimumDaoBounty,10);
    var proposalId = await propose(testSetup);
    var user1Stake = web3.utils.toWei("1");
    var user2Stake = web3.utils.toWei("4");
    await stake(testSetup,proposalId,NO,user1Stake,accounts[1]);
    await stake(testSetup,proposalId,YES,user2Stake,accounts[0]);
    var totalStakes = web3.utils.toWei("5");
    var addTime =15;
    await helpers.increaseTime(60+addTime);
    assert.equal((await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address)).toString(),totalStakes.toString());
    var tx = await testSetup.votableSchemeMock.executeBoosted(proposalId);
    addTime = (await testSetup.votableSchemeMock.proposals(proposalId)).secondsFromTimeOutTillExecuteBoosted.toNumber();
    //check the time is in a resonable range
    assert.equal(((addTime <= 18) && (addTime >=15)),true);
    var expectedBounty = new web3.utils.BN(Math.floor(addTime*user2Stake/15000).toString());
    assert.equal(tx.logs[5].event, "ExpirationCallBounty");
    assert.equal(tx.logs[5].args._proposalId, proposalId);
    assert.equal(tx.logs[5].args._beneficiary, accounts[0]);
    assert.equal(tx.logs[5].args._amount.toString().substring(0,15), expectedBounty.toString().substring(0,15));
    assert.equal((await testSetup.votableSchemeMock.proposals(proposalId)).secondsFromTimeOutTillExecuteBoosted.toNumber(),addTime);
    var totalStakesLeftAfterCallBounty = (new web3.utils.BN(totalStakes)).sub(expectedBounty);
    assert.equal((await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address)).eq(totalStakesLeftAfterCallBounty),true);
    await testSetup.votableSchemeMock.redeem(proposalId,accounts[0]);
    assert.equal((await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address)).eq(totalStakesLeftAfterCallBounty),true);
    await testSetup.votableSchemeMock.redeem(proposalId,accounts[1]);
    let daoBounty = minimumDaoBounty;
    let user1StakeBigNumber = new web3.utils.BN(user1Stake);
    let totalNOStakes = (new web3.utils.BN(daoBounty)).add(user1StakeBigNumber);
    let totalStakesLeftIncludeDaoBounty =  totalNOStakes.add(new web3.utils.BN(user2Stake)).sub(expectedBounty);
    let account1Reward = user1StakeBigNumber.mul(totalStakesLeftIncludeDaoBounty).div(totalNOStakes);
    assert.equal((await testSetup.stakingToken.balanceOf(testSetup.votableSchemeMock.address)).toString(),totalStakesLeftAfterCallBounty.sub(account1Reward).toString());
    await testSetup.votableSchemeMock.redeem(proposalId,testSetup.votableSchemeMock.address);

    let daoBountyReward = await testSetup.votableSchemeMock.redeemDaoBounty.call(proposalId,accounts[0]);
    assert.equal(daoBountyReward[1],0);
  });
  it("activation time", async () => {
    var activationTime = (await web3.eth.getBlock("latest")).timestamp + 1000;
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,2000,0,60,10,15,10,activationTime);

    try {
           await propose(testSetup);
           assert(false, 'not active yet');
        } catch (ex) {
           helpers.assertVMException(ex);
     }
     await helpers.increaseTime(500);

     try {
            await propose(testSetup);
            assert(false, 'not active yet');
         } catch (ex) {
            helpers.assertVMException(ex);
      }
      await helpers.increaseTime(501);

      await propose(testSetup);

  });

  it("threshold ", async () => {

    var thresholdConst = 1700; //1.7
    var testSetup = await setup(accounts,helpers.NULL_ADDRESS,50,60,60,0,thresholdConst);
    await propose(testSetup);
    assert.equal(await threshold(testSetup),1);
    var proposalId = await propose(testSetup);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    await stake(testSetup,proposalId,YES,100,accounts[0]);
    assert.equal(await score(testSetup,proposalId),(100/15).toFixed(2));
    assert.equal(await threshold(testSetup),1700/1000);
     //now boost another proposal
    proposalId = await propose(testSetup);
    await testSetup.votableSchemeMock.vote(proposalId,YES,0,helpers.NULL_ADDRESS);
    await stake(testSetup,proposalId,YES,350,accounts[0]);
    var proposalStatus = await testSetup.votableSchemeMock.proposalStatus(proposalId);
    assert.equal(await score(testSetup,proposalId),(proposalStatus[2]/proposalStatus[3]).toFixed(2));
    var alpha = 1.7;
    assert.equal(await threshold(testSetup),Math.pow(alpha,2).toFixed(2));
  });

});
