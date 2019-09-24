const ERC20 = artifacts.require("ERC20");
const SmtLib = require('../SmtLib.js');

contract("ERC20", (accounts) => {
  const tokens10k = "0x0000000000000000000000000000000000000000000000000000000000002710";
  const tokens9k  = "0x0000000000000000000000000000000000000000000000000000000000002328";
  const tokens8k  = "0x0000000000000000000000000000000000000000000000000000000000001f40";
  const tokens1k  = "0x00000000000000000000000000000000000000000000000000000000000003e8";
  let leaves = {};
  leaves[accounts[0]] = tokens10k;
  let tree = new SmtLib(160, leaves);

  it("should mint 10000 tokens", async () => {
    const erc20 = await ERC20.deployed();

    let total = await erc20.totalSupply();
    assert.equal(total.valueOf(), 10000, "10000 wasn't added to totalSupply");

    // Check the balance of the account that created contract and minted tokens arrived to
    let rsp = await erc20.balanceOf(accounts[0], 10000, tree.createMerkleProof(accounts[0]));
    assert(rsp, "10000 wasn't transfered to first account");

    // negative test. insert wrong balance.
    rsp = await erc20.balanceOf(accounts[0], 10001, tree.createMerkleProof(accounts[0]));
    assert(!rsp, "shows wrong balance");

    //check another account balance
    rsp = await erc20.balanceOf(accounts[1], 0, tree.createMerkleProof(accounts[1]));
    assert(rsp, "Unexpected account balance");

    //negative test. insert wrong balance.
    rsp = await erc20.balanceOf(accounts[2], 1, tree.createMerkleProof(accounts[2]));
    assert(!rsp, "Unexpected account balance");
    //Check the event
    let events = await erc20.getPastEvents("Write", { fromBlock: 0 });
    assert.equal(events.length, 1, "Unexpected events");
    assert.equal(events[0].returnValues[0], accounts[0], "Unexpected event behavior");
    assert.equal(events[0].returnValues[1], tokens10k, "Unexpected event behavior");
  });

  it("should send tokens correctly", async () => {
    const erc20 = await ERC20.deployed();

    //During the transaction we do two writes to smt, so after first write (changing sender balance) the tree state is modified and proofs as well, so for the second write (changing recipient value) we need recipient proof in that interim tree state - after first write and before second.
    leaves[accounts[0]] = tokens9k;
    let tree_transitional = new SmtLib(160, leaves);

    //Correct call
    let res = await erc20.transfer.call(10000, tree.createMerkleProof(accounts[0]), accounts[1], 0, tree_transitional.createMerkleProof(accounts[1]), 1000, { from: accounts[0]});
    assert.equal(res, true, "Must return true");

    //negative call
    try {
      res = await erc20.transfer.call(10000, tree.createMerkleProof(accounts[0]), accounts[1], 0, tree_transitional.createMerkleProof(accounts[1]), 100000, { from: accounts[0]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "error message must contain revert");
    }

    //Send transaction - transfers ownership of 1000 tokens from first account to second account
    let tx = await erc20.transfer(10000, tree.createMerkleProof(accounts[0]), accounts[1], 0, tree_transitional.createMerkleProof(accounts[1]), 1000, { from: accounts[0]});
    //Check the logs
    assert.equal(tx.logs.length, 3, 'trigger three events');
    assert.equal(tx.logs[0].event, 'Write', 'should be the "Write" event');
    assert.equal(tx.logs[0].args._address, accounts[0], 'logs the senders key, path in sparse merkle tree');
    assert.equal(tx.logs[0].args._value, tokens9k, 'logs the senders value, leaf in sparse merkle tree');
    assert.equal(tx.logs[1].event, 'Write', 'should be the "Write" event');
    assert.equal(tx.logs[1].args._address, accounts[1], 'logs the recipients key, path in sparse merkle tree');
    assert.equal(tx.logs[1].args._value, tokens1k, 'logs the recipients value, leaf in sparse merkle tree');
    assert.equal(tx.logs[2].event, 'Transfer', 'should be the "Transfer" event');
    assert.equal(tx.logs[2].args.from, accounts[0], 'logs the account the tokens are transfered from');
    assert.equal(tx.logs[2].args.to, accounts[1], 'logs the account the tokens are transfered to');
    assert.equal(tx.logs[2].args.value.toNumber(), 1000, 'logs the transfer amount');
    //Check the balances
    leaves[accounts[1]] = tokens1k;
    tree = new SmtLib(160, leaves);
    let rsp = await erc20.balanceOf(accounts[0], 9000, tree.createMerkleProof(accounts[0]));
    assert(rsp, "Sender balance didn't change");

    rsp = await erc20.balanceOf(accounts[1], 1000, tree.createMerkleProof(accounts[1]));
    assert(rsp, "Recipient balance didn't change");

  });


  it("should send tokens correctly when sender and recipient is the same address", async () => {
    const erc20 = await ERC20.deployed();

    assert.equal(leaves[accounts[0]], tokens9k, 'Wrong initial state');
    //Demonstrates that the proof for one key(address) isn't changed when you changed the leaf (proof is changed when other leaves are changed).
    let sender_proof = tree.createMerkleProof(accounts[0]);

    leaves[accounts[0]] = tokens8k;
    let tree_transitional = new SmtLib(160, leaves);
    assert.equal(sender_proof, tree_transitional.createMerkleProof(accounts[0]), 'Wrong initial state');


    //Negative call (using output parameters that aws service give)
    try {
      let res = await erc20.transfer.call(9000, sender_proof, accounts[0], 9000, tree_transitional.createMerkleProof(accounts[0]), 1000, { from: accounts[0]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "error message must contain revert");
    }

    //Send transaction (using output parameters that aws service give)- transfers ownership of 1000 tokens from first account to first account
    try {
      let tx = await erc20.transfer(9000, sender_proof, accounts[0], 9000, tree_transitional.createMerkleProof(accounts[0]), 1000, { from: accounts[0]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "error message must contain revert");
      assert.equal(e.reason, 'update proof not valid', "incorrect reason of the revert")
    }

    //Correct call. Remark: sender and recipient is the same address, but the balances are different, because of the writting order. When transfer happens firstly rewrites senders balance, so before rewriting recipient balance happens the tree consist the new value of the recipient balance, this value we should put as a parameter like we do with proof.
    let res = await erc20.transfer.call(9000, sender_proof, accounts[0], 8000, tree_transitional.createMerkleProof(accounts[0]), 1000, { from: accounts[0]});
    assert.equal(res, true, "Must return true");

    //Send transaction - transfers ownership of 1000 tokens from first account to first account
    let tx = await erc20.transfer(9000, sender_proof, accounts[0], 8000, tree_transitional.createMerkleProof(accounts[0]), 1000, { from: accounts[0]});
    //Check the logs
    assert.equal(tx.logs.length, 3, 'trigger three events');
    assert.equal(tx.logs[0].event, 'Write', 'should be the "Write" event');
    assert.equal(tx.logs[0].args._address, accounts[0], 'logs the senders key, path in sparse merkle tree');
    assert.equal(tx.logs[0].args._value, tokens8k, 'logs the senders value, leaf in sparse merkle tree');
    assert.equal(tx.logs[1].event, 'Write', 'should be the "Write" event');
    assert.equal(tx.logs[1].args._address, accounts[0], 'logs the recipients key, path in sparse merkle tree');
    assert.equal(tx.logs[1].args._value, tokens9k, 'logs the recipients value, leaf in sparse merkle tree');
    assert.equal(tx.logs[2].event, 'Transfer', 'should be the "Transfer" event');
    assert.equal(tx.logs[2].args.from, accounts[0], 'logs the account the tokens are transfered from');
    assert.equal(tx.logs[2].args.to, accounts[0], 'logs the account the tokens are transfered to');
    assert.equal(tx.logs[2].args.value.toNumber(), 1000, 'logs the transfer amount');

    //Check the balances
    leaves[accounts[0]] = tokens9k;
    tree = new SmtLib(160, leaves);

    let rsp = await erc20.balanceOf(accounts[0], 9000, tree_transitional.createMerkleProof(accounts[0]));
    assert(rsp, "Senders or/and recipients balance shouldn't change");

    rsp = await erc20.balanceOf(accounts[0], 9000, tree.createMerkleProof(accounts[0]));
    assert(rsp, "Senders or/and recipients balance shouldn't change");
  });
});
