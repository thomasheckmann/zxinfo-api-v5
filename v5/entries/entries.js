const moduleId = "entries";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const tools = require("../common/utils");
const queryHelper = require("../common/queryTerms");
const search = require("../common/helpersSearch");
const helpers = require("../common/helpersRequest");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

router.use(function (req, res, next) {
    debug(`ENTRIES: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    helpers.defaultRouter(moduleId, debug, req, res, next);
});

/**
 * Return entry with :entryid
 * 
 * OK:
 * curl "http://localhost:3000/v5/entries/0002259" | jq .
 * 
 * NOT OK: (invalid ID)
 * curl -s -D - "http://localhost:3000/v5/entries/002259x"
 * 
 * NOT FOUND:
 * curl -s -D - "http://localhost:3000/v5/entries/1231231"
 * 
 * RETURNS:
 * 200: OK
 * 404: Not Found (ID not found)
 * 422: Invalid Input (ID is invalid)
 * 500: Server error
 */
var getEntryById = function (entryid, outputmode) {
    debug(`getEntryById() : ${entryid}, outputmode: ${outputmode}`);

    return elasticClient.get({
        _source_includes: tools.es_source_item(outputmode),
        _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
        index: config.index_entries,
        id: entryid,
    });
};

router.get("/entries/:entryid", function (req, res, next) {
    debug("==> /entries/:entryid");
    debug(
        `entryid: ${req.params.entryid}, len: ${req.params.entryid.length}, isInt: ${Number.isInteger(parseInt(req.params.entryid))}`
    );

    // check input
    const isNumeric = (string) => /^[+-]?\d+(\.\d+)?$/.test(string);

    if (!isNumeric(req.params.entryid)) {
        debug(`INVALID entryid, not a number: ${req.params.entryid.trim()}`);
        res.status(422).end();
        return;
    }

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
                if (!reason.found) {
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

/**
 * Return games starting with letter :letter
 * 
 * OK:
 * curl "http://localhost:3000/v5/entries/byletter/a" | jq .
 * 
 * WRONG INPUT:
 * curl -s -D - "http://localhost:3000/v5/entries/byletter/aa"
 * 
 * RETURNS:
 * 200: OK
 * 422: Invalid Input (letter is invalid)
*/
router.get("/entries/byletter/:letter", function (req, res, next) {
    debug(`==> /entries/byletter/ [${req.params.letter}]`);

    // check input
    const validInput = /^[a-zA-Z#]$/.test(req.params.letter);
    if (!validInput) {
        debug(`INVALID letter found: ${req.params.letter.trim()}`);
        res.status(422).end();
        return;
    }

    req.query = tools.setDefaultValuesModeSizeOffsetSort(req.query);
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

/**
 * Returns list of entries similar to :entryid
 * 
 * OK:
 * curl "http://localhost:3000/v5/entries/morelikethis/0002259" | jq .
 * 
 * NOT OK: (invalid ID)
 * curl -s -D - "http://localhost:3000/v5/entries/morelikethis/002259x"
 * 
 * NOT FOUND - 0 entries
 * curl "http://localhost:3000/v5/entries/morelikethis/1231231"
 * 
 * RETURNS:
 * 200: OK
 */

router.get("/entries/morelikethis/:entryid", function (req, res, next) {
    debug(`==> /entries/morelikethis/ [${req.params.entryid}]`);

    // check input
    const isNumeric = (string) => /^[+-]?\d+(\.\d+)?$/.test(string);

    if (!isNumeric(req.params.entryid)) {
        debug(`INVALID entryid, not a number: ${req.params.entryid.trim()}`);
        res.status(422).end();
        return;
    }

    req.query = tools.setDefaultValuesModeSizeOffsetSort(req.query);
    const sortObject = tools.getSortObject(req.query.sort);
    const filterQuery = queryHelper.createFilterQuery(req);

    if (Number.isInteger(parseInt(req.params.entryid)) && req.params.entryid.length < 8) {
        const id = ("0000000" + req.params.entryid).slice(-7);

        var q = {
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

        const aggregationQuery = queryHelper.createAggregationQuery(req, q);

        search.searchEntries(q, aggregationQuery, req.query.size, req.query.offset, sortObject, req.query.mode, req.query.explain, req.query.output, res);
    } else {
        res.status(404).end();
    }
});

/**
 * Returns list of entries by :author
 * 
 * OK:
 * curl "http://localhost:3000/v5/entries/byauthor/ritman" | jq .
 * 
 * NOT FOUND - 0 entries
 * curl -s -D - "http://localhost:3000/v5/entries/byauthor/abcdefghij"
 * 
 * RETURNS:
 * 200: OK
 */

router.get("/entries/byauthor/:name", function (req, res, next) {
    debug(`==> /entries/byauthor/ [${req.params.name}]`);

    req.query = tools.setDefaultValuesModeSizeOffsetSort(req.query);
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

/**
 * Returns list of entries by :author
 * 
 * OK:
 * curl "http://localhost:3000/v5/entries/bypublisher/ocean" | jq .
 * 
 * NOT FOUND - 0 entries
 * curl -s -D - "http://localhost:3000/v5/entries/bypublisher/abcdefghij"
 * 
 * RETURNS:
 * 200: OK
 */

router.get("/entries/bypublisher/:name", function (req, res, next) {
    debug(`==> /entries/bypublisher/ [${req.params.name}]`);

    req.query = tools.setDefaultValuesModeSizeOffsetSort(req.query);
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

/**
 * Returns list of random entries X
 * 
 * OK:
 * curl "http://localhost:3000/v5/entries/random/10" | jq .
 * 
 * NOT OK: (invalid ID)
 * curl -s -D - "http://localhost:3000/v5/entries/morelikethis/002259x"
 * 
 * NOT FOUND - 0 entries
 * curl "http://localhost:3000/v5/entries/morelikethis/1231231"
 * 
 * RETURNS:
 * 200: OK
 */
function getRandomX(total, outputmode) {
    debug("getRandomX()");

    if (outputmode !== "full" && outputmode !== "compact") {
        outputmode = "tiny";
    }
    return elasticClient.search({
        _source_includes: tools.es_source_item(outputmode),
        _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
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

    // check input
    const isNumeric = (string) => /^[+-]?\d+(\.\d+)?$/.test(string);

    if (!isNumeric(req.params.total)) {
        debug(`INVALID total, not a number: ${req.params.total.trim()}`);
        res.status(422).end();
        return;
    }

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
