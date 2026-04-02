import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";
import { es_source_item, getSortObject, renderFlatOutputEntry, renderFlatOutputEntries, renderSimpleOutput } from "../common/utils.js";
import { createFilterQuery, createAggregationQuery } from "../search/queryTerms.js";
import { ZXSearchEntries } from "../search/helpersSearch.js";

const moduleId = "entries";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const router = express.Router();

/**
 * Fetches a single ZXDB entry by its zero-padded 7-digit ID.
 *
 * @param {string} entryid - Zero-padded 7-digit entry ID.
 * @param {string} outputmode - Source field set (full, compact, tiny).
 * @returns {Promise<Object>} Elasticsearch get response.
 */
const getEntryById = (entryid, outputmode) => {
  debug(`getEntryById() : ${entryid}, outputmode: ${outputmode}`);
  return elasticClient.get({
    _source_includes: es_source_item(outputmode),
    _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
    index: config.index_entries,
    id: entryid,
  });
};

router.use((req, res, next) => {
  debug(`ENTRIES: ${req.path}`);
  debug(`user-agent: ${req.headers["user-agent"]}`);
  defaultRouter(moduleId, debug, req, res, next);
});

/**
 * GET /entries/:entryid
 *
 * Returns a single ZXDB entry by its numeric ID.
 * The ID is normalised to a zero-padded 7-digit string before lookup.
 *
 * Query params:
 *   mode   {string} - Source field set, default compact
 *   output {string} - Set to "flat" for key=value text output
 *
 * Responses:
 *   200 - Entry document
 *   400 - Invalid entry ID
 *   404 - Entry not found
 *   500 - Elasticsearch error
 */
router.get("/entries/:entryid", async (req, res) => {
  debug("==> /entries/:entryid");
  debug(
    `entryid: ${req.params.entryid}, len: ${req.params.entryid.length}, isInt: ${Number.isInteger(parseInt(req.params.entryid))}`
  );

  if (Number.isInteger(parseInt(req.params.entryid)) && req.params.entryid.length < 8) {
    const id = ("0000000" + req.params.entryid).slice(-7);
    try {
      const result = await getEntryById(id, req.query.mode);
      debug(`########### RESPONSE from getEntryById(${id},${req.query.mode})`);
      debug(result);
      debug(`#############################################################`);
      if (req.query.output === "flat") {
        res.header("content-type", "text/plain;charset=UTF-8");
        res.send(renderFlatOutputEntry(result));
      } else {
        res.send(result);
      }
    } catch (reason) {
      debug(`[FAILED] reason: ${reason.message}`);
      res.status(reason.message === "Not Found" ? 404 : 500).end();
    }
  } else {
    res.status(400).end();
  }
});

/**
 * GET /entries/byletter/:letter
 *
 * Returns entries whose title starts with the given letter, or # for titles starting with a digit.
 *
 * Query params:
 *   offset       {number} - Page number (0-based), default 0
 *   size         {number} - Results per page (1-100), default 15
 *   sort         {string} - Sort mode, default rel_desc
 *   mode         {string} - Source field set, default compact
 *   output       {string} - Optional: simple or flat
 *   explain      {*}      - Return raw Elasticsearch response when present
 *   includeagg   {*}      - Include aggregation buckets when true/1
 *   contenttype, machinetype, genretype, genresubtype,
 *   control, multiplayermode, multiplayertype, xrated,
 *   availability, language, year, tosectype,
 *   group, groupname      - Optional filters
 *
 * Responses:
 *   200 - Matching entries
 *   500 - Elasticsearch error
 */
router.get("/entries/byletter/:letter", async (req, res) => {
  debug(`==> /entries/byletter/ [${req.params.letter}]`);

  const sortObject = getSortObject(req.query.sort);
  const filterQuery = createFilterQuery(req);

  const letter = req.params.letter.toLowerCase();
  const expr = letter === "#"
    ? "[0-9].*"
    : "[" + letter.toLowerCase() + letter.toUpperCase() + "].*";

  const qLetter = {
    regexp: {
      "title.keyword": {
        value: expr,
        flags: "ALL",
      },
    },
  };

  const q = {
    bool: {
      must: [qLetter],
      filter: {
        bool: {
          must: filterQuery,
        },
      },
    },
  };
  const aggregationQuery = createAggregationQuery(req, q);
  await ZXSearchEntries(q, aggregationQuery, req.query.includeagg, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
});

/**
 * GET /entries/morelikethis/:entryid
 *
 * Returns entries similar to the given entry, matched on genre type, machine type, and content type.
 * The entry ID is normalised to a zero-padded 7-digit string before lookup.
 *
 * Query params:
 *   offset       {number} - Page number (0-based), default 0
 *   size         {number} - Results per page (1-100), default 15
 *   sort         {string} - Sort mode, default rel_desc
 *   mode         {string} - Source field set, default compact
 *   output       {string} - Optional: simple or flat
 *   explain      {*}      - Return raw Elasticsearch response when present
 *   includeagg   {*}      - Include aggregation buckets when true/1
 *
 * Responses:
 *   200 - Similar entries
 *   404 - Invalid entry ID
 *   500 - Elasticsearch error
 */
router.get("/entries/morelikethis/:entryid", async (req, res) => {
  debug(`==> /entries/morelikethis/ [${req.params.entryid}]`);

  const sortObject = getSortObject(req.query.sort);
  const filterQuery = createFilterQuery(req);

  if (Number.isInteger(parseInt(req.params.entryid)) && req.params.entryid.length < 8) {
    const id = ("0000000" + req.params.entryid).slice(-7);

    const q = {
      more_like_this: {
        fields: ["machineType", "genreType", "genreSubType", "contentType"],
        like: [
          {
            _index: config.index_entries,
            _id: id,
          },
        ],
        min_term_freq: 1,
        max_query_terms: 12,
        minimum_should_match: "80%",
      }
    };

    const aggregationQuery = createAggregationQuery(req, q);
    await ZXSearchEntries(q, aggregationQuery, req.query.includeagg, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
  } else {
    res.status(404).end();
  }
});

/**
 * GET /entries/byauthor/:name
 *
 * Returns entries associated with an author or group name matching the given prefix.
 * Searches both the author name and group name fields.
 *
 * Query params:
 *   offset       {number} - Page number (0-based), default 0
 *   size         {number} - Results per page (1-100), default 15
 *   sort         {string} - Sort mode, default rel_desc
 *   mode         {string} - Source field set, default compact
 *   output       {string} - Optional: simple or flat
 *   explain      {*}      - Return raw Elasticsearch response when present
 *   includeagg   {*}      - Include aggregation buckets when true/1
 *   contenttype, machinetype, genretype, genresubtype,
 *   control, multiplayermode, multiplayertype, xrated,
 *   availability, language, year, tosectype,
 *   group, groupname      - Optional filters
 *
 * Responses:
 *   200 - Matching entries
 *   500 - Elasticsearch error
 */
router.get("/entries/byauthor/:name", async (req, res) => {
  debug(`==> /entries/byauthor/ [${req.params.name}]`);

  const sortObject = getSortObject(req.query.sort);
  const filterQuery = createFilterQuery(req);

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
  const aggregationQuery = createAggregationQuery(req, q);
  await ZXSearchEntries(query, aggregationQuery, req.query.includeagg, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
});

/**
 * GET /entries/bypublisher/:name
 *
 * Returns entries whose publisher name matches the given prefix.
 * Searches both the original publisher list and per-release publisher names.
 *
 * Query params:
 *   offset       {number} - Page number (0-based), default 0
 *   size         {number} - Results per page (1-100), default 15
 *   sort         {string} - Sort mode, default rel_desc
 *   mode         {string} - Source field set, default compact
 *   output       {string} - Optional: simple or flat
 *   explain      {*}      - Return raw Elasticsearch response when present
 *   includeagg   {*}      - Include aggregation buckets when true/1
 *   contenttype, machinetype, genretype, genresubtype,
 *   control, multiplayermode, multiplayertype, xrated,
 *   availability, language, year, tosectype,
 *   group, groupname      - Optional filters
 *
 * Responses:
 *   200 - Matching entries
 *   500 - Elasticsearch error
 */
router.get("/entries/bypublisher/:name", async (req, res) => {
  debug(`==> /entries/bypublisher/ [${req.params.name}]`);

  const sortObject = getSortObject(req.query.sort);
  const filterQuery = createFilterQuery(req);

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

  const aggregationQuery = createAggregationQuery(req, q);
  await ZXSearchEntries(query, aggregationQuery, req.query.includeagg, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
});

/**
 * Fetches a random selection of game entries with screens.
 * Limits outputmode to full, compact, or tiny.
 *
 * @param {number} total - Number of random entries to return.
 * @param {string} outputmode - Source field set.
 * @returns {Promise<Object>} Elasticsearch search response.
 */
const getRandomX = (total, outputmode) => {
  debug("getRandomX()");

  if (outputmode !== "full" && outputmode !== "compact") {
    outputmode = "tiny";
  }
  return elasticClient.search({
    _source_includes: es_source_item(outputmode),
    _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
    index: config.index_entries,
    size: total,
    query: {
      function_score: {
        query: {
          bool: {
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
  });
};

/**
 * GET /entries/random/:total
 *
 * Returns a random selection of software entries that have screenshots.
 *
 * Query params:
 *   mode   {string} - Source field set (full, compact, tiny)
 *   output {string} - Optional: simple or flat
 *
 * Responses:
 *   200 - Random entry documents
 *   500 - Elasticsearch error
 */
router.get("/entries/random/:total", async (req, res) => {
  debug("==> /entries/random/:total");
  debug(`total: ${req.params.total}, mode: ${req.query.mode}`);

  try {
    const result = await getRandomX(req.params.total, req.query.mode);
    debug(`########### RESPONSE from getRandomX(${req.params.total}, mode: ${req.query.mode})`);
    debug(result);
    debug(`#############################################################`);
    res.header("X-Total-Count", result.hits.total.value);
    if (req.query.output === "simple") {
      res.send(renderSimpleOutput(result));
    } else if (req.query.output === "flat") {
      res.header("content-type", "text/plain;charset=UTF-8");
      res.send(renderFlatOutputEntries(result));
    } else {
      res.send(result);
    }
  } catch (err) {
    debug(`[FAILED] reason: ${err.message}`);
    res.status(500).end();
  }
});

export default router;
