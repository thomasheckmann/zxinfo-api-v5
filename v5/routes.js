"use strict";

var express = require("express");
var router = express.Router();
var debug = require("debug")("zxinfo-api-v5");

const filesearch = require("./filesearch/filesearch");
const suggest = require("./suggest/suggest");

/************************************************
 *
 * common to use for all requests
 *
 ************************************************/
router.use(function (req, res, next) {
  debug(`API v5 got request - start processing, path: ${req.path}`);
  debug(`user-agent: ${req.headers["user-agent"]}`);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  // do logging
  next(); // make sure we go to the next routes and don't stop here
});

router.get("/filesearch/*", filesearch);
router.get("/suggest/*", suggest);

router.get("*", (req, res) => {
  debug("[CATCH ALL]");
  res.send("Hello World! api-v5 catch all - read more about this API here <link>: " + req.path);
});

module.exports = router;
