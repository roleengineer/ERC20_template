const SmtLib = require('./SmtLib.js');
const Web3 = require('web3');
const bigInt = require('big-integer');
const AWS = require('aws-sdk');

let provider = process.env.provider;
const web3 = new Web3(provider);

let contract_abi = [{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"bytes","name":"proof","type":"bytes"}],"name":"balanceOf","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"sender_balance","type":"uint256"},{"internalType":"bytes","name":"sender_proof","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"recipient_balance","type":"uint256"},{"internalType":"bytes","name":"recipient_proof","type":"bytes"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"root","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"sender_balance","type":"uint256"},{"internalType":"bytes","name":"sender_proof","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"recipient_balance","type":"uint256"},{"internalType":"bytes","name":"recipient_proof","type":"bytes"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_initialSupply","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_address","type":"address"},{"indexed":true,"internalType":"bytes32","name":"_value","type":"bytes32"}],"name":"Write","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"}];
let contract_address = process.env.contract_address;


const contract = new web3.eth.Contract(contract_abi, contract_address);

const docClient = new AWS.DynamoDB.DocumentClient({region: process.env.region});


exports.handler = async (event) => {

    //db
    let leaves;
    let currBlock;

    let params = {
        Key: {
            index: 0
        },
        TableName: 'Leaves'
    };
    //get data from db
    try {
        let data = await docClient.get(params).promise();
        currBlock = data.Item.blockNumber;
        leaves = data.Item.leaves;
    } catch (e) {
        console.log(e);
    }
    //get data from contract events since the last block that was written to db
    let events = await contract.getPastEvents('Write', {fromBlock: currBlock});
    for (let i = 0; i < events.length; i++) {
      currBlock = events[i].blockNumber;
      leaves[events[i].returnValues[0]] = events[i].returnValues[1];
    }
    //write actual data to db
    params = {
        TableName: 'Leaves',
        Key : {
            index: 0
        },
        UpdateExpression: 'set blockNumber = :b, leaves = :l',
        ExpressionAttributeValues: {
            ":b" : currBlock,
            ":l" : leaves
        },
        ReturnValues:"UPDATED_NEW"
    };

    try {
        let data = await docClient.update(params).promise();
        console.log(data);
    } catch (e) {
        console.log(e);
    }


    //Users input
    let sender = event.queryStringParameters.sender;
    if (web3.utils.isAddress(sender) || web3.utils.isAddress(sender.toLowerCase())) {
        sender = web3.utils.toChecksumAddress(sender);
    } else {
        return { statusCode: 200, body: JSON.stringify({message : 'Invalid address. Wrong input in requested parameter - sender.'}) };
    }
    let recipient = event.queryStringParameters.recipient;
    if (web3.utils.isAddress(recipient) || web3.utils.isAddress(recipient.toLowerCase())) {
        recipient = web3.utils.toChecksumAddress(recipient);
    } else {
        return { statusCode: 200, body: JSON.stringify({message : 'Invalid address. Wrong input in requested parameter - recipient.'}) };
    }
    let amount = event.queryStringParameters.amount;

    //transfer
    let zx = '0x';
    let tree = new SmtLib(160, leaves);
    let sender_balance;
    let tr_bal;
    let output;
    if (sender in leaves) {
        sender_balance = leaves[sender];
        sender_balance = bigInt(sender_balance.substring(2), 16).toString();
        tr_bal = (bigInt(leaves[sender].substring(2), 16).minus(bigInt(amount))).toString(16);
        if (tr_bal.length < 64) {
          tr_bal = zx + '0'.repeat(64 - tr_bal.length) + tr_bal;
        } else if (tr_bal.length == 64) {
          tr_bal = zx + tr_bal;
        } else {
          throw "Unexpected error";
        }

        let sender_proof = tree.createMerkleProof(sender);
        let recipient_balance;
        if (recipient in leaves) {
          recipient_balance = leaves[recipient];
          recipient_balance = bigInt(recipient_balance.substring(2), 16).toString();
        } else {
          recipient_balance = '0';
        }

        leaves[sender] = tr_bal; //This absolutely must not be added to db
        let tr_tree = new SmtLib(160, leaves);
        let recipient_proof = tr_tree.createMerkleProof(recipient);
        amount = bigInt(amount).toString();

        output = {
          'sender' : sender,
          'sender_balance' : sender_balance,
          'sender_proof' : sender_proof,
          'recipient' : recipient,
          'recipient_balance' : recipient_balance,
          'recipient_proof' : recipient_proof,
          'amount' : amount
        };

    } else {
        let tree = new SmtLib(160, leaves);

        let balance = '0';

        let proof = tree.createMerkleProof(sender);
        output = {
            message: 'Senders balance equals to 0, so the transfer is impossible.',
            'address' : sender,
            'balance' : balance,
            'proof' : proof
        };
    }



    const response = {
        statusCode: 200,
        body: JSON.stringify(output),

    };
    return response;
};
