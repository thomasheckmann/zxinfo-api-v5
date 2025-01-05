const config = require("../config.json")[process.env.NODE_ENV || "development"];

const { Client, ClientOptions } = require("@elastic/elasticsearch");

const { Transport } = require('@elastic/transport');
let baseUrl = config.es_host ? config.es_host : "http://localhost:9200";
let path = config.es_path ? config.es_path : "";

// then create a class, that extends Transport class to modify the path
class MTransport extends Transport {
  request(params, options, callback) {
    params.path = path + params.path // <- append the path right here
    return super.request(params, options, callback)
  }
}

// and finally put the extended class on the options.
const elasticClient = new Client({
  node: baseUrl,
  apiVersion: config.es_apiVersion,
  log: config.es_log,
  Transport: MTransport,
});

// const elasticsearch = require("@elastic/elasticsearch");
// const elasticClient = new elasticsearch.Client({
//   node: config.es_host,
//   apiVersion: config.es_apiVersion,
//   log: config.es_log,
// });

const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = { elasticClient, config, isDevelopment };