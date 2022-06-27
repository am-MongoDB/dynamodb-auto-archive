var AWS = require("aws-sdk");
const getClient = require("./client").getClient;

const COUNTER_KEY = "COUNTER"

exports.handler = async (event, context) => {
  const filteredRecords = event.Records.filter((record) => {
    return (record.eventName === "INSERT" || record.eventName === "MODIFY") &&
            record.dynamodb.Keys.ID.S !== COUNTER_KEY
  })
  let firehouse = new AWS.Firehose();
  filteredRecords.forEach ( record => {
    if (record.dynamodb && record.dynamodb.OldImage) {
      console.log(`Sending this doc to stream: ${JSON.stringify(record.dynamodb.OldImage)}`);
      let archiveEntry = {
        Record: {Data: new Buffer(JSON.stringify(record.dynamodb.OldImage))},
        DeliveryStreamName: process.env.FIREHOSE_NAME
      };
      firehouse.putRecord(archiveEntry, function (err, data) {
        if (err) {
            console.error("couldn't stream", err.stack);
        }
        else {
            console.log(`INFO - successfully sent to Firehose: ${process.env.FIREHOSE_NAME}`);
        }
      });
    }
  })

  await getClient().updateItem({
    TableName: process.env.TABLE_NAME,
    Key: {
      'ID': { 'S': COUNTER_KEY }
    },
    UpdateExpression: "SET #totalViews = if_not_exists(#totalViews, :zero) + :inc",
    ExpressionAttributeNames: {
      "#totalViews": "TotalViews"
    },
    ExpressionAttributeValues: {
      ":inc": { "N": filteredRecords.length.toString() },
      ":zero": { "N": "0" }
    }
  }).promise()
};
