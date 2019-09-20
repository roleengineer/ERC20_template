const ERC20 = artifacts.require("ERC20");
const SmtLib = require('../SmtLib.js');

contract("ERC20", (accounts) => {
  const tokens10k = "0x0000000000000000000000000000000000000000000000000000000000002710";
  const tokens9k  = "0x0000000000000000000000000000000000000000000000000000000000002328";
  const tokens8k  = "0x0000000000000000000000000000000000000000000000000000000000001f40";
  const tokens1k  = "0x00000000000000000000000000000000000000000000000000000000000003e8";
  const tokens750 = "0x00000000000000000000000000000000000000000000000000000000000002ee";
  const tokens250 = "0x00000000000000000000000000000000000000000000000000000000000000fa";
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

  it("should approve tokens for delegated transfer", async () => {
    const erc20 = await ERC20.deployed();

    //Correct call
    let res = await erc20.approve.call(accounts[2], 500, { from: accounts[1] });
    assert.equal(res, true, "Must return true");

    //negative call
    try {
      res = await erc20.approve.call(accounts[2], 1001, { from: accounts[1]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "error message must contain revert");
    }

    //Send transaction - approves third account to spend 500 tokens that belongs second account
    let tx = await erc20.approve(accounts[2], 500, { from: accounts[1]});
    //Check the logs
    assert.equal(tx.logs.length, 1, 'trigger one event');
    assert.equal(tx.logs[0].event, 'Approval', 'should be the "Approval" event');
    assert.equal(tx.logs[0].args.owner, accounts[1], 'logs the account the tokens are authorized by');
    assert.equal(tx.logs[0].args.spender, accounts[2], 'logs the account the tokens are authorized to');
    assert.equal(tx.logs[0].args.value.toNumber(), 500, 'logs the transfer amount');
    //Check the allowance
    let rsp = await erc20.allowance(accounts[1], accounts[2]);
    assert.equal(rsp, 500, "Allowance is incorrect");
    //another parameters
    rsp = await erc20.allowance(accounts[0], accounts[1]);
    assert.equal(rsp, 0, "Allowance is incorrect");

    //Send another transaction
    await erc20.approve(accounts[5], 10, {from: accounts[0]});
    //check the allowance
    rsp = await erc20.allowance(accounts[0], accounts[5]);
    assert.equal(rsp, 10, "Allowance is incorrect");

    //Increase allowance correct call
    res = await erc20.increaseAllowance.call(accounts[5], 40, { from: accounts[0] });
    assert.equal(res, true, "Must return true");

    //negative call
    try {
      res = await erc20.increaseAllowance.call(accounts[5], 9100, { from: accounts[0]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "error message must contain revert");
    }

    //Decrease allowance correct call
    res = await erc20.decreaseAllowance.call(accounts[5], 5, { from: accounts[0] });
    assert.equal(res, true, "Must return true");

    //negative call
    try {
      res = await erc20.decreaseAllowance.call(accounts[5], 20, { from: accounts[0]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "error message must contain revert");
    }

    //Send transaction - increases amount of tokens (belongs to first account) that sixth account can spend
    tx = await erc20.increaseAllowance(accounts[5], 40, { from: accounts[0]});
    //Check the logs
    assert.equal(tx.logs.length, 1, 'trigger one event');
    assert.equal(tx.logs[0].event, 'Approval', 'should be the "Approval" event');
    assert.equal(tx.logs[0].args.owner, accounts[0], 'logs the account the tokens are authorized by');
    assert.equal(tx.logs[0].args.spender, accounts[5], 'logs the account the tokens are authorized to');
    assert.equal(tx.logs[0].args.value.toNumber(), 50, 'logs the transfer amount');

    //Send transaction - decreases amount of tokens (belongs to first account) that sixth account can spend
    tx = await erc20.decreaseAllowance(accounts[5], 25, { from: accounts[0]});
    //Check the logs
    assert.equal(tx.logs.length, 1, 'trigger one event');
    assert.equal(tx.logs[0].event, 'Approval', 'should be the "Approval" event');
    assert.equal(tx.logs[0].args.owner, accounts[0], 'logs the account the tokens are authorized by');
    assert.equal(tx.logs[0].args.spender, accounts[5], 'logs the account the tokens are authorized to');
    assert.equal(tx.logs[0].args.value.toNumber(), 25, 'logs the transfer amount');

    //Check the allowance
    rsp = await erc20.allowance(accounts[0], accounts[5]);
    assert.equal(rsp, 25, "Allowance is incorrect");
  });

  it("handles delegated transfer", async () => {
    const erc20 = await ERC20.deployed();
    //acc2 sends to acc3 from acc1
    leaves[accounts[1]] = tokens750;
    let tree_transitional = new SmtLib(160, leaves);
    // Correct call
    let res = await erc20.transferFrom.call(accounts[1], 1000, tree.createMerkleProof(accounts[1]), accounts[3], 0, tree_transitional.createMerkleProof(accounts[3]), 250, { from: accounts[2]});
    assert.equal(res, true, "Must return true");

    //negative call - try transferring something larger than the approved amount
    try {
      res = await erc20.transferFrom.call(accounts[1], 1000, tree.createMerkleProof(accounts[1]), accounts[3], 0, tree_transitional.createMerkleProof(accounts[3]), 501, { from: accounts[2]});
    } catch (e) {
      assert(e.message.indexOf("revert") >= 0, "cannot transfer value larger than allowance");
    }

    //Send transaction - third account sends the tx that changing the ownership of 250 tokens from second account to fourth account
    let tx = await erc20.transferFrom(accounts[1], 1000, tree.createMerkleProof(accounts[1]), accounts[3], 0, tree_transitional.createMerkleProof(accounts[3]), 250, { from: accounts[2]});
    //Check logs
    assert.equal(tx.logs.length, 4, 'trigger four event');
    assert.equal(tx.logs[0].event, 'Approval', 'should be the "Approval" event');
    assert.equal(tx.logs[0].args.owner, accounts[1], 'logs the account the tokens are authorized by');
    assert.equal(tx.logs[0].args.spender, accounts[2], 'logs the account the tokens are authorized to');
    assert.equal(tx.logs[0].args.value.toNumber(), 250, 'logs the transfer amount');
    assert.equal(tx.logs[1].event, 'Write', 'should be the "Write" event');
    assert.equal(tx.logs[1].args._address, accounts[1], 'logs the senders key, path in sparse merkle tree');
    assert.equal(tx.logs[1].args._value, tokens750, 'logs the senders value, leaf in sparse merkle tree');
    assert.equal(tx.logs[2].event, 'Write', 'should be the "Write" event');
    assert.equal(tx.logs[2].args._address, accounts[3], 'logs the recipients key, path in sparse merkle tree');
    assert.equal(tx.logs[2].args._value, tokens250, 'logs the recipients value, leaf in sparse merkle tree');
    assert.equal(tx.logs[3].event, 'Transfer', 'should be the "Transfer" event');
    assert.equal(tx.logs[3].args.from, accounts[1], 'logs the account the tokens are transfered from');
    assert.equal(tx.logs[3].args.to, accounts[3], 'logs the account the tokens are transfered to');
    assert.equal(tx.logs[3].args.value.toNumber(), 250, 'logs the transfer amount');

    leaves[accounts[3]] = tokens250;
    tree = new SmtLib(160, leaves);

    //check the allowance
    let rsp = await erc20.allowance(accounts[1], accounts[2]);
    assert.equal(rsp, 250, "Allowance is incorrect");

    //Check the balances
    rsp = await erc20.balanceOf(accounts[1], 750, tree.createMerkleProof(accounts[1]));
    assert.equal(rsp, true, "Must return true");
    rsp = await erc20.balanceOf(accounts[3], 250, tree.createMerkleProof(accounts[3]));
    assert.equal(rsp, true, "Must return true");
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
