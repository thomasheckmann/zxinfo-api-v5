const moduleId = "entries";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const { elasticClient, config, isDevelopment } = require("../common/elastic");

router.use(function (req, res, next) {
    debug(`ENTRIES: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    next(); // make sure we go to the next routes and don't stop here
  });
  
/**
    Return game with :gameid
*/
router.get("/entries/:entryid", function (req, res, next) {
    debug("==> /entries/:entryid");
    debug(
      `entryid: ${req.params.entryid}, len: ${req.params.entryid.length}, isInt: ${Number.isInteger(parseInt(req.params.entryid))}`
    );
  
    if (Number.isInteger(parseInt(req.params.entryid)) && req.params.entryid.length < 8) {
      const id = ("0000000" + req.params.entryid).slice(-7);
  
      getEntryById(id, req.query.mode).then(
        function (result) {
          debug(`########### RESPONSE from getEntryById(${id},${req.query.mode})`);
          debug(result);
          debug(`#############################################################`);
          //res.send(tools.renderMagazineLinks(result));
          if (req.query.output === "flat") {
            res.header("content-type", "text/plain;charset=UTF-8");
            res.send(tools.renderFlatOutputEntry(result));
          } else {
            res.send(result);
          }
        },
        function (reason) {
          debug(`[FAILED] reason: ${reason.message}`);
          if (reason.message === "Not Found") {
            res.status(404).end();
          } else {
            res.status(500).end();
          }
        }
      );
    } else {
      res.status(400).end();
    }
  });
  
  router.get("/entries/byletter/:letter", function (req, res, next) {
    debug(`==> /entries/byletter/ [${req.params.letter}]`);
  
    const sortObject = tools.getSortObject(req.query.sort);
    const filterQuery = queryHelper.createFilterQuery(req);
  
    var letter = req.params.letter.toLowerCase();
  
    var expr;
    if (letter === "#") {
      expr = "[0-9].*";
    } else {
      expr = "[" + letter.toLowerCase() + letter.toUpperCase() + "].*";
    }
  
    // base query
    var qLetter =
    {
      regexp: {
        "title.keyword": {
          value: expr,
          flags: "ALL",
        },
      },
    };
  
    const q =
    {
      bool: {
        must: [qLetter],
        filter: {
          bool: {
            must: filterQuery,
          },
        },
      },
    };
    const aggregationQuery = queryHelper.createAggregationQuery(req, q);
  
    search.searchEntries(q, aggregationQuery, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
  });
  
  router.get("/entries/morelikethis/:entryid", function (req, res, next) {
    debug(`==> /entries/morelikethis/ [${req.params.entryid}]`);
  
    const sortObject = tools.getSortObject(req.query.sort);
    const filterQuery = queryHelper.createFilterQuery(req);
  
    if (Number.isInteger(parseInt(req.params.entryid)) && req.params.entryid.length < 8) {
      const id = ("0000000" + req.params.entryid).slice(-7);
  
      var q = {
        more_like_this: {
          fields: ["machineType", "genreType", "genreSubType", "contentType"],
          like: [
            {
              _index: "zxinfo_games",
              _id: id,
            },
          ],
          min_term_freq: 1,
          max_query_terms: 12,
          minimum_should_match: "80%",
        }
      };
  
      const aggregationQuery = queryHelper.createAggregationQuery(req, q);
  
      search.searchEntries(q, aggregationQuery, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
    } else {
      res.status(404).end();
    }
  });

  router.get("/entries/byauthor/:name", function (req, res, next) {
    debug(`==> /entries/byauthor/ [${req.params.name}]`);
  
    const sortObject = tools.getSortObject(req.query.sort);
    const filterQuery = queryHelper.createFilterQuery(req);
  
    const q = {
      bool: {
        should: [
          {
            nested: {
              path: "authors",
              query: {
                bool: {
                  must: [
                    {
                      match_phrase_prefix: {
                        "authors.name": req.params.name,
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            nested: {
              path: "authors",
              query: {
                bool: {
                  must: [
                    {
                      match_phrase_prefix: {
                        "authors.groupName": req.params.name,
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
        minimum_should_match: 1,
      },
    };
  
    const query = {
      bool: {
        must: q,
        filter: {
          bool: {
            must: filterQuery,
          },
        },
      },
    };
    const aggregationQuery = queryHelper.createAggregationQuery(req, q);
  
    search.searchEntries(query, aggregationQuery, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
  });
  
  /************************************************
   *
   * requests served by this endpoint
   *
   ************************************************/
  router.get("/entries/bypublisher/:name", function (req, res, next) {
    debug(`==> /entries/bypublisher/ [${req.params.name}]`);
  
    const sortObject = tools.getSortObject(req.query.sort);
    const filterQuery = queryHelper.createFilterQuery(req);
  
    const q = {
      bool: {
        should: [
          {
            nested: {
              path: "publishers",
              query: {
                bool: {
                  must: [
                    {
                      match_phrase_prefix: {
                        "publishers.name": req.params.name,
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            nested: {
              path: "releases",
              query: {
                nested: {
                  path: "releases.publishers",
                  query: {
                    bool: {
                      must: [
                        {
                          match_phrase_prefix: {
                            "releases.publishers.name": req.params.name,
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
      },
    };
  
    const query = {
      bool: {
        must: q,
        filter: {
          bool: {
            must: filterQuery,
          },
        },
      },
    };
  
    const aggregationQuery = queryHelper.createAggregationQuery(req, q);
  
    search.searchEntries(query, aggregationQuery, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
  });
  
  function getRandomX(total, outputmode) {
    debug("getRandomX()");
  
    if (outputmode !== "full" && outputmode !== "compact") {
      outputmode = "tiny";
    }
    return elasticClient.search({
      _source: tools.es_source_item(outputmode),
      _sourceExcludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
      body:
      //-- BODY
      {
        size: total,
        query: {
          function_score: {
            query: {
              bool: {
                must_not: [],
                must: [
                  {
                    terms: { genreType: ["Adventure Game", "Arcade Game", "Casual Game", "Game", "Sport Game", "Strategy Game"] },
                  },
                  {
                    match: {
                      contentType: "SOFTWARE",
                    },
                  },
                ],
                should: [
                  {
                    nested: {
                      path: "screens",
                      query: {
                        bool: {
                          must: [
                            {
                              match: {
                                "screens.type": "Loading screen",
                              },
                            },
                            {
                              match: {
                                "screens.format": "Picture",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                  {
                    nested: {
                      path: "screens",
                      query: {
                        bool: {
                          must: [
                            {
                              match: {
                                "screens.type": "Running screen",
                              },
                            },
                            {
                              match: {
                                "screens.format": "Picture",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
                minimum_should_match: 1,
              },
            },
            functions: [
              {
                random_score: { seed: "" + Date.now(), field: "_seq_no" },
              },
            ],
          },
        },
      },
    });
  };
  
  router.get("/entries/random/:total", function (req, res, next) {
    debug("==> /entries/random/:total");
    debug(`total: ${req.params.total}, mode: ${req.query.mode}`);
  
    getRandomX(req.params.total, req.query.mode).then(function (result) {
      debug(`########### RESPONSE from getRandomX(${req.params.total}, mode: ${req.query.mode})`);
      debug(result);
      debug(`#############################################################`);
      res.header("X-Total-Count", result.hits.total.value);
      if (req.query.output === "simple") {
        res.send(tools.renderSimpleOutput(result));
      } else if (req.query.output === "flat") {
        res.header("content-type", "text/plain;charset=UTF-8");
        res.send(tools.renderFlatOutputEntries(result));
      } else {
        res.send(result);
      }
    });
  });
  
  module.exports = router;