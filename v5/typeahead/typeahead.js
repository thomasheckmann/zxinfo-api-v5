/**
 * ZXINFO API v4 typeahead
 *
 */
"use strict";

const moduleId = "typeahead";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const { elasticClient, config, isDevelopment } = require("../common/elastic");

var getTypeaheadSuggestions = function (context, query) {
  const expandedContext =
    context === "ALL" ? ["SOFTWARE", "HARDWARE", "BOOK", "MAGZINE", "ENTITY", "GROUP", "LICENSE"] : context;
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

  next(); // make sure we go to the next routes and don't stop here
});

/* GET title suggestions for completion (all) */
router.get("/typeahead/:context/:query", function (req, res, next) {
  debug("==> /:context = " + req.params.context);
  debug("==> /:query = " + req.params.query);
  getTypeaheadSuggestions(req.params.context, req.params.query).then(function (result) {
    debug(`########### RESPONSE from getTypeaheadSuggestions(${req.params.query})`);
    debug(result);
    debug(`#############################################################`);

    if (isDevelopment) {
      console.log(JSON.stringify(result, null, 2));
    }

    res.send(prepareSuggestionsResponse(result));
  });
});

router.get("/", (req, res) => {
  console.log(`[CATCH ALL - ${moduleId}]`);
  console.log(req.path);
  res.send(`Hello World from /${moduleId}`);
});

module.exports = router;
