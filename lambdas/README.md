# How to set up lambda functions manually via [AWS Management Console](console.aws.amazon.com)?

## AWS Lambda

- Click Services button in the navbar, print 'lambda' and press Enter. You are here 'Lambda/Functions'.
- Click 'Create function', choose 'Author from scratch', enter function name on your behaviour, choose Runtime - Node.js 10.x, click 'create function'. You are here 'Lambda/Functions/YourFunctionName'
- Copy code from balanceOf_lambda.js or transfer_lambda.js (accordingly what function you are creating at the moment) and paste it instead of this basic code below into index.js.

```javascript
exports.handler = async (event) => {
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};
```  
- Mouse right button click on the folder -> New file, named it 'SmtLib.js' and copy/paste code from SmtLib.js
- Environment variables. Set up three variables. Key = contract_address Value = checksumaddress of the contract you deployed. Key = provider Value = your Infura provider url. Key = region Value = your aws region.
- Basic setting. Choose memory - 256MB.
- Add trigger. API Gateway. API - Create a new API. Security - Open. Click Add.
- Click Save. You are here 'Lambda/Functions/YourFunctionName', go back to 'Lambda' choose Layers, click create layer, enter name 'big_integer', upload big_integer.zip, choose Runtime - Node.js 10.x, click create. Create three layers in this way.
- Go back to your function click Layers, Add layer, Select from list of runtime compatible layers, choose name, version, add. Add three layers in this way.

## DynamoDB

- Click Services button in the navbar, print 'dynamodb' and press Enter. Press Create table. Table name - Leaves (another name requires changes in the function code). Primary key - index (another key requires changes in the function code), choose type Number. Press create table.
- Choose Items tab. Create item. index Value - 0. Press '+', Append -> Number, Field - blockNumber, Value - the number of the block where your contract was deployed at. Press '+', Append -> Map, Field - leaves, press '+', Append -> String, Field - checksumed ethereum address of the token contract creator (the address initial supply was minted and transfered to), Value - bytes32 initial supply (e.g., 0x000000000000000000000000000000000000000000000000000000000010c8e0). Click Save.
- Switch tab to Overview. Copy Amazon Resource Name (ARN).

### Permissions
- Click Services button in the navbar, print 'iam' and press Enter. Choose Roles. Find YourFunctionName-role (was created when you was creating lambda) and click it. Click Add inline policy. Service choose DynamoDB (choose All DynamoDB actions or choose manually Access level for read and write permissions), Resources -> table -> Add ARN -> Paste copied previously ARN to Specify ARN for table field. Click Add. Click Review policy. Named it and click Create policy.

## API Gateway
- Click Services button in the navbar, print 'api' and press Enter. Choose YourFunctionName-API -> Resources -> ANY -> click Method Request -> URL Query String Parameters -> press Add query string. For balanceOf_lambda function name address -> submit create a new query string. Click View documentation and instead basic code like below:
```json
{
    "description": ""
}
```
paste this:
```JSON
{
  "address": "$input.params('address')"
}
```
and click Save. Submit Required flag and edit Request Validator (Validate query string parameters and headers).
- For transfer function create three query strings named sender, recipient, amount and instead basic code insert the code below accordingly to the strings:
```JSON
{
  "sender": "$input.params('sender')"
}
```
```JSON
{
  "recipient": "$input.params('recipient')"
}
```
```JSON
{
  "amount": "$input.params('amount')"
}
```
Don't forget about required flag and request validator.
- Click Actions -> Deploy API -> Deployment stage = default -> Deploy.
- Stages -> default -> YourFunctionName -> GET copy your function Invoke URL.

That's it. Your function works. Use your Invoke URL with parameters and share it with your token holders.  
