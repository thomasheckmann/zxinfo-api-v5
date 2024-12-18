const config = require("../config.json")[process.env.NODE_ENV || "development"];

const elasticsearch = require("@elastic/elasticsearch");
const elasticClient = new elasticsearch.Client({
  node: config.es_host,
  apiVersion: config.es_apiVersion,
  log: config.es_log,
});

const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = { elasticClient, config, isDevelopment };
