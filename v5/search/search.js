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
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);
const debugError = debugLib(`zxinfo-api-v5:${moduleId}:error`);
const router = express.Router();

const formatLogValue = (value) => {
    if (value === undefined || value === null) {
        return "n/a";
    }
    const text = String(value);
    return text.includes(" ") ? JSON.stringify(text) : text;
};

const logEvent = (logger, fields) => {
    const message = Object.entries(fields)
        .map(([key, value]) => `${key}=${formatLogValue(value)}`)
        .join(" ");
    logger(message);
};

/**
 * Normalizes the requested page size to the supported search range.
 * Defaults to 15 and clamps the value to 1-100.
 *
 * @param {string|number|undefined} rawSize - Requested page size.
 * @returns {number} Normalized page size.
 */
const parsePageSize = (rawSize) => Math.min(100, Math.max(1, parseInt(rawSize, 10) || 15));

/**
 * Normalizes the requested page offset to a non-negative page number.
 *
 * @param {string|number|undefined} rawOffset - Requested page offset.
 * @returns {number} Zero-based page offset.
 */
const parseOffset = (rawOffset) => Math.max(0, parseInt(rawOffset, 10) || 0);

/**
 * Validates and trims the incoming search term path parameter.
 * Rejects empty values and terms longer than 200 characters.
 *
 * @param {string} value - Raw search term from the request path.
 * @param {import("express").Response} res - Express response used for validation errors.
 * @returns {string|null} Trimmed search term, or null if validation failed.
 */
const validateSearchTerm = (value, res, route) => {
    const searchTerm = value.trim();
    if (searchTerm.length === 0) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route,
            errMessage: "Search term must not be empty",
            status: 422,
        });
        res.status(422).json({ error: "Search term must not be empty" });
        return null;
    }
    if (searchTerm.length > 200) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route,
            errMessage: "Search term must not exceed 200 characters",
            status: 422,
        });
        res.status(422).json({ error: "Search term must not exceed 200 characters" });
        return null;
    }
    return searchTerm;
};

/**
 * Executes the Elasticsearch-backed search request using the common helper.
 * Applies pagination, sorting, output mode, explain output, and optional aggregations.
 *
 * @param {Object} args - Search execution options.
 * @param {import("express").Request} args.req - Express request.
 * @param {import("express").Response} args.res - Express response.
 * @param {Object} args.query - Elasticsearch query body.
 * @param {Object} args.aggregationQuery - Elasticsearch aggregations definition.
 */
const executeSearch = async ({ req, res, query, aggregationQuery, route }) => {
    logEvent(debugTrace, {
        level: "trace",
        event: "request.search.dispatch",
        module: moduleId,
        route,
        size: parsePageSize(req.query.size),
        offset: parseOffset(req.query.offset),
        sort: req.query.sort,
        mode: req.query.mode,
        includeAgg: req.query.includeagg,
        output: req.query.output,
    });

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

/**
 * Wraps a positive query in a boosting query that lowers the rank of derivative,
 * compilation, and covertape entries without removing them from the result set.
 *
 * @param {Object} positive - Base Elasticsearch query.
 * @returns {Object} Boosting query definition.
 */
const createBoostedQuery = (positive) => ({
    boosting: {
        positive,
        negative: queryTermNegativeBoost(),
        negative_boost: 0.5,
    },
});

router.use((req, res, next) => {
    logEvent(debug, {
        level: "info",
        event: "module.middleware",
        module: moduleId,
        path: req.path,
        method: req.method,
        userAgent: req.headers["user-agent"],
    });
    defaultRouter(moduleId, debug, req, res, next);
});

/**
 * GET /search
 *
 * Returns all entries using a match-all query, optionally constrained by filters.
 * Supports pagination, sorting, alternate output formats, and aggregation data.
 *
 * Query params:
 *   offset       {number} - Page number (0-based), default 0
 *   size         {number} - Results per page (1-100), default 15
 *   sort         {string} - Sort mode, default rel_desc
 *   mode         {string} - Source field set, default compact
 *   output       {string} - Optional response format: simple or flat
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
router.get("/search", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/search",
        method: req.method,
        path: req.path,
    });

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
        route: "/search",
    });
});

/**
 * GET /search/:searchterm
 *
 * Performs the default weighted search across titles, OCR text, authors,
 * publishers, release titles, and related metadata.
 *
 * Query params:
 *   Same as GET /search
 *
 * Responses:
 *   200 - Matching entries
 *   422 - Invalid search term
 *   500 - Elasticsearch error
 */
router.get("/search/:searchterm", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/search/:searchterm",
        method: req.method,
        path: req.path,
    });

    const searchTerm = validateSearchTerm(req.params.searchterm, res, "/search/:searchterm");
    if (searchTerm === null) {
        return;
    }

    logEvent(debug, {
        level: "info",
        event: "request.validated",
        module: moduleId,
        route: "/search/:searchterm",
        searchTermLen: searchTerm.length,
    });

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
        route: "/search/:searchterm",
    });
});

/**
 * GET /search/titles/:searchterm
 *
 * Restricts searching to title-oriented fields only.
 * Uses the same pagination, sorting, output, and filter options as the main search endpoint.
 *
 * Query params:
 *   Same as GET /search
 *
 * Responses:
 *   200 - Matching entries
 *   422 - Invalid search term
 *   500 - Elasticsearch error
 */
router.get("/search/titles/:searchterm", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/search/titles/:searchterm",
        method: req.method,
        path: req.path,
    });

    const searchTerm = validateSearchTerm(req.params.searchterm, res, "/search/titles/:searchterm");
    if (searchTerm === null) {
        return;
    }

    logEvent(debug, {
        level: "info",
        event: "request.validated",
        module: moduleId,
        route: "/search/titles/:searchterm",
        searchTermLen: searchTerm.length,
    });

    const filterQuery = createFilterQuery(req);
    const query = queryTermTitlesOnly(searchTerm, filterQuery);

    await executeSearch({
        req,
        res,
        query: createBoostedQuery(query),
        aggregationQuery: createAggregationQuery(req, query),
        route: "/search/titles/:searchterm",
    });
});

/**
 * GET /search/screens/:searchterm
 *
 * Restricts searching to OCR and scanned screen text.
 * Uses the same pagination, sorting, output, and filter options as the main search endpoint.
 *
 * Query params:
 *   Same as GET /search
 *
 * Responses:
 *   200 - Matching entries
 *   422 - Invalid search term
 *   500 - Elasticsearch error
 */
router.get("/search/screens/:searchterm", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/search/screens/:searchterm",
        method: req.method,
        path: req.path,
    });

    const searchTerm = validateSearchTerm(req.params.searchterm, res, "/search/screens/:searchterm");
    if (searchTerm === null) {
        return;
    }

    logEvent(debug, {
        level: "info",
        event: "request.validated",
        module: moduleId,
        route: "/search/screens/:searchterm",
        searchTermLen: searchTerm.length,
    });

    const filterQuery = createFilterQuery(req);
    const query = queryTermScreenOnly(searchTerm, filterQuery);

    await executeSearch({
        req,
        res,
        query,
        aggregationQuery: createAggregationQuery(req, query),
        route: "/search/screens/:searchterm",
    });
});

export default router;
