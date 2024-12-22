/**
 * ZXINFO API v5 typeahead
 *
 */
"use strict";

const moduleId = "typeahead";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();
const helpers = require("../common/helpersRequest");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

/**
 * Returns a list of suggestions for :context and :query
 * 
 * context = ALL => [array with all]
 * 
 * OK:
 * curl "http://localhost:3000/v5//typeahead/ALL/zx81" | jq .
 * 
 * NOTHING FOUND:
 * curl -s -D - "http://localhost:3000/v5//typeahead/LICENSE/kaffe"
 * 
 * WRONG INPUT:
 * curl -s -D - "http://localhost:3000/v5/typeahead/X/zx81"
 * 
 * RETURNS:
 * 200: OK
 * 422: Invalid Input (context is invalid)
 * 500: Server error
 */
const validContext = ["SOFTWARE", "HARDWARE", "BOOK", "MAGZINE", "ENTITY", "GROUP", "LICENSE"];

var getTypeaheadSuggestions = function (context, query) {
  const expandedContext =
    context === "ALL" ? validContext : context;
  return elasticClient.search({
    index: config.index_search,
    body: {
      suggest: {
        quick_suggest: {
          prefix: query,
          completion: {
            field: "title",
            size: 15,
            analyzer: "standard",
            contexts: {
              genre: expandedContext,
            },
          },
        },
      },
    },
  });
};

var prepareSuggestionsResponse = function (result) {
  var suggestons = [];
  debug(`No of suggestions: ${result.suggest.quick_suggest[0].options.length}`);

  // iterate result
  for (var i = 0; i < result.suggest.quick_suggest[0].options.length; i++) {
    var item = {
      id: result.suggest.quick_suggest[0].options[i]._source.id,
      name: result.suggest.quick_suggest[0].options[i]._source.fulltitle,
      comment: result.suggest.quick_suggest[0].options[i]._source.comment,
      type: result.suggest.quick_suggest[0].options[i]._source.type,
    };
    suggestons.push(item);
  }
  return suggestons;
};

router.use(function (req, res, next) {
  debug(`TYPEAHEAD: ${req.path}`);
  debug(`user-agent: ${req.headers["user-agent"]}`);

  helpers.defaultRouter(moduleId, debug, req, res, next);
});

/* GET title suggestions for completion (all) */
router.get("/typeahead/:context/:query", function (req, res, next) {
  debug("==> /:context = " + req.params.context);
  debug("==> /:query = " + req.params.query);

  // check input
  if (!["ALL", ...validContext].includes(req.params.context.trim())) {
    debug(`INVALID context found: ${req.params.context.trim()}`);
    res.status(422).end();
    return;
  }
  getTypeaheadSuggestions(req.params.context, req.params.query).then(function (result) {
    debug(`########### RESPONSE from getTypeaheadSuggestions(${req.params.query})`);
    debug(result);
    debug(`#############################################################`);

    if (isDevelopment) {
      console.log(JSON.stringify(result, null, 2));
    }

    res.header("X-Total-Count", result.hits.total.value);
    res.send(prepareSuggestionsResponse(result));
  });
});

router.get("/", (req, res) => {
  console.log(`[CATCH ALL - ${moduleId}]`);
  console.log(req.path);
  res.send(`Hello World from /${moduleId}`);
});

module.exports = router;
