import { DataStream } from "@scramjet/core";

module.exports = async (req, res) => {
  // Example: Echo the incoming request body, transformed by Scramjet DataStream
  const body = req.body || {};
  const result = [{ ...body, processed: true }];

  res.status(200).json(result);
};