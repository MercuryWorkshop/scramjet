const { DataStream } = require("@scramjet/core");

module.exports = async (req, res) => {
  // Example: Echo the incoming request body, transformed by Scramjet DataStream
  const body = req.body || {};
  const stream = DataStream.from([body]);
  const result = await stream
    .map(obj => ({ ...obj, processed: true }))
    .toArray();

  res.status(200).json(result);
};