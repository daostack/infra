/**
    helpers for tests
*/

export const NULL_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const SOME_HASH = '0x1000000000000000000000000000000000000000000000000000000000000000';
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const SOME_ADDRESS = '0x1000000000000000000000000000000000000000';


export class TestSetup {
  constructor() {
  }
}

export class VotingMachine {
  constructor() {
  }
}

export class Organization {
  constructor() {
  }
}

export function getProposalAddress(tx) {
    // helper function that returns a proposal object from the ProposalCreated event
    // in the logs of tx
    assert.equal(tx.logs[0].event, 'ProposalCreated');
    const proposalAddress = tx.logs[0].args.proposaladdress;
    return proposalAddress;
}

export function getValueFromLogs(tx, arg, eventName, index=0) {
  /**
   *
   * tx.logs look like this:
   *
   * [ { logIndex: 13,
   *     transactionIndex: 0,
   *     transactionHash: '0x999e51b4124371412924d73b60a0ae1008462eb367db45f8452b134e5a8d56c8',
   *     blockHash: '0xe35f7c374475a6933a500f48d4dfe5dce5b3072ad316f64fbf830728c6fe6fc9',
   *     blockNumber: 294,
   *     address: '0xd6a2a42b97ba20ee8655a80a842c2a723d7d488d',
   *     type: 'mined',
   *     event: 'NewOrg',
   *     args: { _organization: '0xcc05f0cde8c3e4b6c41c9b963031829496107bbb' } } ]
   */
  if (!tx.logs || !tx.logs.length) {
    throw new Error('getValueFromLogs: Transaction has no logs');
  }

  if (eventName !== undefined) {
    for (let i=0; i < tx.logs.length; i++) {
      if (tx.logs[i].event  === eventName) {
        index = i;
        break;
      }
    }
    if (index === undefined) {
      let msg = `getValueFromLogs: There is no event logged with eventName ${eventName}`;
      throw new Error(msg);
    }
  } else {
    if (index === undefined) {
      index = tx.logs.length - 1;
    }
  }
  let result = tx.logs[index].args[arg];
  if (!result) {
    let msg = `getValueFromLogs: This log does not seem to have a field "${arg}": ${tx.logs[index].args}`;
    throw new Error(msg);
  }
  return result;
}

export async function getProposalId(tx,contract,eventName) {
  var proposalId;
  await contract.getPastEvents(eventName, {
            fromBlock: tx.blockNumber,
            toBlock: 'latest'
      })
        .then(function(events){
            proposalId = events[0].args._proposalId;
        });
  return proposalId;
}

export async function getOrganization(tx,contract,eventName) {
  var organization;
  await contract.getPastEvents(eventName, {
            fromBlock: tx.blockNumber,
            toBlock: 'latest'
      })
        .then(function(events){
            organization = events[0].args._organization;
        });
  return organization;
}

export async function getProposal(tx) {
    return await Proposal.at(getProposalAddress(tx));
}

export async function etherForEveryone() {
    // give all web3.eth.accounts some ether
    let accounts = web3.eth.accounts;
    for (let i=0; i < 10; i++) {
        await web3.eth.sendTransaction({to: accounts[i], from: accounts[0], value: web3.toWei(0.1, "ether")});
    }
}

export const outOfGasMessage = 'VM Exception while processing transaction: out of gas';

export function assertJumpOrOutOfGas(error) {
    let condition = (
        error.message === outOfGasMessage ||
        error.message.search('invalid JUMP') > -1
    );
    assert.isTrue(condition, 'Expected an out-of-gas error or an invalid JUMP error, got this instead: ' + error.message);
}

export function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

export function assertInternalFunctionException(error) {
    let condition = (
        error.message.search('is not a function') > -1
    );
    assert.isTrue(condition, 'Expected a function not found Exception, got this instead:' + error.message);
}

export function assertJump(error) {
  assert.isAbove(error.message.search('invalid JUMP'), -1, 'Invalid JUMP error must be returned' + error.message);
}

export const checkVoteInfo = async function(absoluteVote,proposalId, voterAddress, _voteInfo) {
  let voteInfo;
  voteInfo = await absoluteVote.voteInfo(proposalId, voterAddress);
  // voteInfo has the following structure
  // int vote;
  assert.equal(voteInfo[0], _voteInfo[0]);
  // uint reputation;
  assert.equal(voteInfo[1], _voteInfo[1]);
};


export const checkVotesStatus = async function(proposalId, _votesStatus,votingMachine){

  let voteStatus;
  for (var i = 0; i < _votesStatus.length; i++) {
      voteStatus = await votingMachine.voteStatus(proposalId,i);
      assert.equal(voteStatus, _votesStatus[i]);
  }
};


// Increases testrpc time by the passed duration in seconds
export const increaseTime = async function(duration) {
  const id = Date.now();
  web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send;
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
};
