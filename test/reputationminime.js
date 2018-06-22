const helpers = require('./helpers');
import { getValueFromLogs } from './helpers';

var Reputation = artifacts.require("./ReputationMinime.sol");
var ReputationMinimeTokenFactory = artifacts.require("./ReputationMinimeTokenFactory.sol");

contract('Reputation', accounts => {
    it("test setting and getting reputation by the owner", async () => {
        let value;
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 3131);

        value = await reputation.reputationOf(accounts[1]);
        assert.equal(value.valueOf(), 3131);
    });

    it("should be owned by the main account", async () => {
let reputation = await Reputation.new();
        let owner = await reputation.owner();
        assert.equal(owner, accounts[0]);
    });

    it("check permissions", async () => {
let reputation = await Reputation.new();
        await reputation.mint(accounts[1], 1000);

        // only the owner can call mint
        try {
            await reputation.mint(accounts[2], 1000, { from: accounts[2] });
            throw 'an error'; // make sure that an error is thrown
        } catch (error) {
            helpers.assertVMException(error);
        }

        let account0Rep = await reputation.reputationOf(accounts[0]);
        let account1Rep = await reputation.reputationOf(accounts[1]);
        let account2Rep = await reputation.reputationOf(accounts[2]);
        let totalRep = await reputation.totalSupply();

        assert.equal(account1Rep, 1000, "account 1 reputation should be 1000");
        assert.equal(account2Rep, 0, "account 2 reputation should be 0");

        assert.equal(parseInt(totalRep), parseInt(account0Rep) + parseInt(account1Rep), "total reputation should be sum of account0 and account1");
    });

    it("check total reputation", async () => {
let reputation = await Reputation.new();
        await reputation.mint(accounts[0], 2000);
        await reputation.mint(accounts[1], 1000);
        await reputation.mint(accounts[1], 500);
        await reputation.mint(accounts[2], 3000);

        // this tx should have no effect
        let account0Rep = await reputation.reputationOf(accounts[0]);
        let account1Rep = await reputation.reputationOf(accounts[1]);
        let account2Rep = await reputation.reputationOf(accounts[2]);

        // assert.equal(account0Rep, 2001, "account 0 reputation should be 2000");
        assert.equal(account1Rep.valueOf(), 1500, "account 1 reputation should be 1000 + 500");
        assert.equal(account2Rep.valueOf(), 3000, "account 2 reputation should be 3000");

        let totalRep = await reputation.totalSupply();

        assert.equal(parseInt(totalRep), parseInt(account0Rep) + parseInt(account1Rep) + parseInt(account2Rep), "total reputation should be sum of accounts");
    });

    it("check total reputation overflow", async () => {
let reputation = await Reputation.new();
        let BigNumber = require('bignumber.js');
        let bigNum = ((new BigNumber(2)).toPower(128).sub(1));

        await reputation.mint(accounts[0], bigNum);

        let totalRepBefore = await reputation.totalSupply();

        try {
            await reputation.mint(accounts[1], 1);
            throw 'an error'; // make sure that an error is thrown
        } catch (error) {
            helpers.assertVMException(error);
        }

        let totalRepAfter = await reputation.totalSupply();

        assert(totalRepBefore.equals(totalRepAfter), "reputation should remain the same");
    });

    it("test reducing reputation", async () => {
        let value;
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 1500);
        await reputation.burn(accounts[1], 500);

        value = await reputation.reputationOf(accounts[1]);
        let totalRepSupply = await reputation.totalSupply();

        assert.equal(value.valueOf(), 1000);
        assert.equal(totalRepSupply.valueOf(), 1000);
    });

    it("totalSupply is 0 on init", async () => {
let reputation = await Reputation.new();
        const totalSupply = await reputation.totalSupply();

        assert.equal(totalSupply.toNumber(), 0);
    });

    it("log the Mint event on mint", async () => {
let reputation = await Reputation.new();

        let tx = await reputation.mint(accounts[1], 1000, { from: accounts[0] });
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, "Mint");
        assert.equal(tx.logs[0].args._to, accounts[1]);
        assert.equal(tx.logs[0].args._amount.toNumber(), 1000);
    });

    it("log negative Mint event on negative mint", async () => {
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 1000, { from: accounts[0] });
        let tx = await reputation.burn(accounts[1], 200, { from: accounts[0] });
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, "Burn");
        assert.equal(tx.logs[0].args._from, accounts[1]);
        assert.equal(tx.logs[0].args._amount.toNumber(), 200);
        tx = await reputation.burn(accounts[1], 700, { from: accounts[0] });
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, "Burn");
        assert.equal(tx.logs[0].args._from, accounts[1]);
        assert.equal(tx.logs[0].args._amount.toNumber(), 700);

        try {
            await reputation.burn(accounts[1], 200);
            throw 'an error'; // make sure that an error is thrown
        } catch (error) {
            helpers.assertVMException(error);
        }
    });

    it("mint (plus) should be reflected in totalSupply", async () => {
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 1000, { from: accounts[0] });
        let totalSupply = await reputation.totalSupply();

        assert.equal(totalSupply.toNumber(), 1000);

        await reputation.mint(accounts[2], 500, { from: accounts[0] });
        totalSupply = await reputation.totalSupply();

        assert.equal(totalSupply.toNumber(), 1500);
    });

    it("mint (plus) should be reflected in balances", async () => {
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 1000, { from: accounts[0] });

        const amount = await reputation.reputationOf(accounts[1]);

        assert.equal(amount.toNumber(), 1000);
    });

    it("mint (minus) should be reflected in totalSupply", async () => {
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 1000, { from: accounts[0] });
        let totalSupply = await reputation.totalSupply();
        assert.equal(totalSupply.toNumber(), 1000);

        await reputation.burn(accounts[1], 500, { from: accounts[0] });
        totalSupply = await reputation.totalSupply();
        assert.equal(totalSupply.toNumber(), 500);

        // await reputation.burn(accounts[1], 700, { from: accounts[0] });
        // totalSupply = await reputation.totalSupply();
        // assert.equal(totalSupply.toNumber(), 0);
    });

    it("mint (minus) should be reflected in balances", async () => {
let reputation = await Reputation.new();

        await reputation.mint(accounts[1], 1000, { from: accounts[0] });
        await reputation.burn(accounts[1], 500, { from: accounts[0] });

        let amount = await reputation.reputationOf(accounts[1]);

        assert.equal(amount.toNumber(), 500);

        // await reputation.burn(accounts[1], 700, { from: accounts[0] });
        // amount = await reputation.reputationOf(accounts[1]);
        // assert.equal(amount.toNumber(), 0);
    });

    describe('onlyOwner', () => {

        it('mint by owner', async () => {

            let reputation = await Reputation.new();
            try {
                await reputation.mint(accounts[1], 10, { from: accounts[0] });
            } catch (error) {
                assert(false, 'owner could not mint');
            }
        });

        it('mint by not owner', async () => {

            let reputation = await Reputation.new();
            try {
                await reputation.mint(accounts[1], 10, { from: accounts[1] });
                throw 'some exception';
            } catch (error) {
                helpers.assertVMException(error);
            }
        });
    });

    // it("account balance cannot be negative", async () => {
    //
    //     let reputation = await Reputation.new();
    //
    //     await reputation.mint(accounts[1], 1, { from: accounts[0] });
    //
    //     let amount = await reputation.reputationOf(accounts[1]);
    //     assert.equal(amount.toNumber(), 1);
    //     await reputation.burn(accounts[1], 2, { from: accounts[0] });
    //     let rep = await reputation.reputationOf(accounts[1]);
    //     assert.equal(reputation.toNumber(), 0);
    // });

    // it("totalSupply cannot be negative", async () => {
    //
    //     let reputation = await Reputation.new();
    //
    //     await reputation.mint(accounts[1], 1, { from: accounts[0] });
    //
    //     let amount = await reputation.totalSupply();
    //     assert.equal(amount.toNumber(), 1);
    //     await reputation.burn(accounts[1], 2, { from: accounts[0] });
    //     let rep = await reputation.totalSupply();
    //     assert.equal(reputation.toNumber(), 0);
    // });

    it("reputationOf = balances", async () => {
let reputation = await Reputation.new();

        const rep1 = Math.floor(Math.random() * 1e6);
        const rep2 = Math.floor(Math.random() * 1e6);
        const rep3 = Math.floor(Math.random() * 1e6);

        await reputation.mint(accounts[1], rep1, { from: accounts[0] });
        await reputation.mint(accounts[2], rep2, { from: accounts[0] });
        await reputation.mint(accounts[3], rep3, { from: accounts[0] });

        const reputationOf1 = await reputation.reputationOf(accounts[1]);
        const reputationOf2 = await reputation.reputationOf(accounts[2]);
        const reputationOf3 = await reputation.reputationOf(accounts[3]);

        assert.equal(reputationOf1.toNumber(), rep1);
        assert.equal(reputationOf2.toNumber(), rep2);
        assert.equal(reputationOf3.toNumber(), rep3);
    });

    it("reputation at ", async () => {
        let reputation = await Reputation.new();
        const rep1 = Math.floor(Math.random() * 1e6);
        await reputation.mint(accounts[1], rep1, { from: accounts[0] });
        var tx = await reputation.mint(accounts[1], rep1, { from: accounts[0] });
        await reputation.mint(accounts[3], rep1, { from: accounts[0] });


        assert.equal (await reputation.totalSupply(),rep1+rep1+rep1);

        assert.equal (await reputation.totalSupplyAt(tx.receipt.blockNumber),rep1+rep1);
        assert.equal (await reputation.totalSupplyAt(tx.receipt.blockNumber-1),rep1);
        assert.equal (await reputation.balanceOfAt(accounts[1],tx.receipt.blockNumber),rep1+rep1);
        assert.equal (await reputation.balanceOfAt(accounts[1],tx.receipt.blockNumber-1),rep1);

        assert.equal (await reputation.balanceOfAt(accounts[3],tx.receipt.blockNumber),0);

    });
});
