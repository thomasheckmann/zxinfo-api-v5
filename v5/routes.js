import express from "express";
const router = express.Router();
import debugLib from "debug";
const debug = debugLib("zxinfo-api-v5");

import filesearch from "./filesearch/filesearch.js";
import entries from "./entries/entries.js";
import search from "./search/search.js";
import suggest from "./suggest/suggest.js";
import typeahead from "./typeahead/typeahead.js";

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

router.get("/filesearch/*path", filesearch);
router.get("/entries{/*path}", entries);
router.get("/suggest/*path", suggest);
router.get("/search{/*path}", search);
router.get("/typeahead/*path", typeahead);

router.get("/*path", (req, res) => {
  debug("[CATCH ALL]");
  res.send("Hello World! api-v5 catch all - read more about this API here <link>: " + req.path);
});

export default router;
