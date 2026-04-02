import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { getSortObject } from "../common/utils.js";
import {
    createAggregationQuery,
    createFilterQuery,
    queryTermDefault,
    queryTermNegativeBoost,
    queryTermScreenOnly,
    queryTermTitlesOnly,
} from "./queryTerms.js";
import { ZXSearchEntries } from "./helpersSearch.js";

const moduleId = "search";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const router = express.Router();

const parsePageSize = (rawSize) => Math.min(100, Math.max(1, parseInt(rawSize, 10) || 15));
const parseOffset = (rawOffset) => Math.max(0, parseInt(rawOffset, 10) || 0);

const validateSearchTerm = (value, res) => {
    const searchTerm = value.trim();
    if (searchTerm.length === 0) {
        res.status(422).json({ error: "Search term must not be empty" });
        return null;
    }
    if (searchTerm.length > 200) {
        res.status(422).json({ error: "Search term must not exceed 200 characters" });
        return null;
    }
    return searchTerm;
};

const executeSearch = async ({ req, res, query, aggregationQuery }) => {
    await ZXSearchEntries(
        query,
        aggregationQuery,
        req.query.includeagg,
        parsePageSize(req.query.size),
        parseOffset(req.query.offset),
        getSortObject(req.query.sort),
        req.query.mode,
        req.query.explain,
        req.query.output,
        res
    );
};

const createBoostedQuery = (positive) => ({
    boosting: {
        positive,
        negative: queryTermNegativeBoost(),
        negative_boost: 0.5,
    },
});

router.use((req, res, next) => {
    debug(`SEARCH: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);
    defaultRouter(moduleId, debug, req, res, next);
});

router.get("/search", async (req, res) => {
    debug("==> /search [Empty/ALL]");

    const filterQuery = createFilterQuery(req);
    const positiveQuery = {
        bool: {
            must: [{ match_all: {} }],
            filter: {
                bool: {
                    must: filterQuery,
                },
            },
        },
    };

    await executeSearch({
        req,
        res,
        query: createBoostedQuery(positiveQuery),
        aggregationQuery: createAggregationQuery(req, positiveQuery),
    });
});

router.get("/search/:searchterm", async (req, res) => {
    debug(`==> /search [${req.params.searchterm}]`);

    const searchTerm = validateSearchTerm(req.params.searchterm, res);
    if (searchTerm === null) {
        return;
    }

    const filterQuery = createFilterQuery(req);
    const query = queryTermDefault(searchTerm, filterQuery);

    const positiveQuery = {
        bool: {
            must: [query],
            filter: {
                bool: {
                    must: filterQuery,
                },
            },
        },
    };

    await executeSearch({
        req,
        res,
        query: createBoostedQuery(positiveQuery),
        aggregationQuery: createAggregationQuery(req, positiveQuery),
    });
});

router.get("/search/titles/:searchterm", async (req, res) => {
    debug(`==> /search/titles [${req.params.searchterm}]`);

    const searchTerm = validateSearchTerm(req.params.searchterm, res);
    if (searchTerm === null) {
        return;
    }

    const filterQuery = createFilterQuery(req);
    const query = queryTermTitlesOnly(searchTerm, filterQuery);

    await executeSearch({
        req,
        res,
        query: createBoostedQuery(query),
        aggregationQuery: createAggregationQuery(req, query),
    });
});

router.get("/search/screens/:searchterm", async (req, res) => {
    debug(`==> /search/screens [${req.params.searchterm}]`);

    const searchTerm = validateSearchTerm(req.params.searchterm, res);
    if (searchTerm === null) {
        return;
    }

    const filterQuery = createFilterQuery(req);
    const query = queryTermScreenOnly(searchTerm, filterQuery);

    await executeSearch({
        req,
        res,
        query,
        aggregationQuery: createAggregationQuery(req, query),
    });
});

export default router;
