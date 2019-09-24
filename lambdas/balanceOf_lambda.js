const SmtLib = require('./SmtLib.js');
const Web3 = require('web3');
const bigInt = require('big-integer');
const AWS = require('aws-sdk');

let provider = process.env.provider;
const web3 = new Web3(provider);

let contract_abi = [{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"bytes","name":"proof","type":"bytes"}],"name":"balanceOf","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"sender_balance","type":"uint256"},{"internalType":"bytes","name":"sender_proof","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"recipient_balance","type":"uint256"},{"internalType":"bytes","name":"recipient_proof","type":"bytes"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"root","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_initialSupply","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_address","type":"address"},{"indexed":true,"internalType":"bytes32","name":"_value","type":"bytes32"}],"name":"Write","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"}];
let contract_address = process.env.contract_address;

const contract = new web3.eth.Contract(contract_abi, contract_address);

const docClient = new AWS.DynamoDB.DocumentClient({region: process.env.region});

exports.handler = async (event) => {

    //d
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
    let address = event.queryStringParameters.address;
    if (web3.utils.isAddress(address) || web3.utils.isAddress(address.toLowerCase())) {
        address = web3.utils.toChecksumAddress(address);
    } else {
        return { statusCode: 200, body: JSON.stringify({message : 'Invalid address. Wrong input in requested parameter - address.'}) };
    }

    //balanceof
    let tree = new SmtLib(160, leaves);

    let balance;
    if (address in leaves) {
        balance = leaves[address];
        balance = bigInt(balance.substring(2), 16).toString();
    } else {
        balance = '0';
    }
    let proof = tree.createMerkleProof(address);
    let output = {
        'address' : address,
        'balance' : balance,
        'proof' : proof
    };



    const response = {
        statusCode: 200,
        body: JSON.stringify(output),
    };
    return response;
};
