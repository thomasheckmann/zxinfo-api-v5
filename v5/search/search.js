const moduleId = "search";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const tools = require("../common/utils");
const queryHelper = require("../common/queryTerms");
const search = require("./helpersSearch");
const helpers = require("../common/helpersRequest");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

// constans for machinetype
const ZXSPECTRUM = [
    "ZX-Spectrum 128 +2",
    "ZX-Spectrum 128 +2A/+3",
    "ZX-Spectrum 128 +2B",
    "ZX-Spectrum 128 +3",
    "ZX-Spectrum 128K",
    "ZX-Spectrum 128K (load in USR0 mode)",
    "ZX-Spectrum 16K",
    "ZX-Spectrum 16K/48K",
    "ZX-Spectrum 48K",
    "ZX-Spectrum 48K/128K",
];

router.use(function (req, res, next) {
    debug(`SEARCH: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    helpers.defaultRouter(moduleId, debug, req, res, next);
});

/**
 * shortcut for:
 * search/titles/manic?mode=full&size=10&output=flat&contenttype=SOFTWARE&machinetype=ZXSPECTRUM&availability=Available
 */

router.get("/search/titles/:searchterm", function (req, res, next) {
    debug(`==> /search/titles [${req.params.searchterm}]`);

    // set default values
    req.query.contenttype = 'SOFTWARE';

    var mTypes = [];
    mTypes = mTypes.concat(ZXSPECTRUM);
    req.query.machinetype = mTypes;
    debug(`mType: ${mTypes}`);

    const sortObject = tools.getSortObject(req.query.sort);
    const filterQuery = queryHelper.createFilterQuery(req);

    const query = queryHelper.queryTermTitlesOnly(req.params.searchterm, filterQuery);
    const queryNegative = queryHelper.queryTermNegativeBoost();

    // const aggregationQuery = queryHelper.createAggregationQuery(req, query);

    const q = {
        boosting: {
            positive: query,
            negative: queryNegative,
            negative_boost: 0.5,
        },
    };

    search.ZXSearchEntries(q, 15, req.query.offset, sortObject, res);
});

module.exports = router;
