import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "typeahead";
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

const validContexts = ["SOFTWARE", "HARDWARE", "BOOK", "MAGAZINE", "ENTITY", "GROUP", "LICENSE"];

/**
 * Queries completion suggestions for the given context and query.
 * Context can be a specific content group or ALL.
 *
 * @param {string} context - Suggest context (ALL, SOFTWARE, HARDWARE, ...).
 * @param {string} query - Prefix text for completion.
 * @param {string} xrt - "1" to include x-rated entries; any other value excludes them.
 */
const getTypeaheadSuggestions = (context, query, xrt) => {
    let expandedContext = context === "ALL" ? validContexts : context;
    const includeXrated = xrt === "1";

    logEvent(debugTrace, {
        level: "trace",
        event: "request.typeahead.context",
        module: moduleId,
        context,
        includeXrated,
        xrt,
    });

    let contextFilter = {};
    if (!includeXrated) {
        expandedContext = context === "ALL" ? "ALL_false" : `${context}_false`;
        contextFilter = { genre_xrated: `${expandedContext}` };
        logEvent(debugTrace, {
            level: "trace",
            event: "request.typeahead.context.expanded",
            module: moduleId,
            mode: "hide_xrated",
            expandedContext,
        });
    } else {
        contextFilter = { genre: expandedContext };
        logEvent(debugTrace, {
            level: "trace",
            event: "request.typeahead.context.expanded",
            module: moduleId,
            mode: "show_xrated",
            expandedContext,
        });
    }

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
                        contexts: contextFilter,
                    },
                },
            },
        },
    });
};

/**
 * Flattens completion results into API response objects.
 *
 * @param {Object} result - Raw Elasticsearch response.
 * @returns {Object[]} Typeahead suggestion entries.
 */
const prepareSuggestionsResponse = (result) => {
    const suggestions = [];
    const options = result?.suggest?.quick_suggest?.[0]?.options ?? [];
    logEvent(debugTrace, {
        level: "trace",
        event: "request.typeahead.options",
        module: moduleId,
        total: options.length,
    });

    for (const opt of options) {
        suggestions.push({
            comment: opt._source.comment,
            type: opt._source.type,
            id: opt._source.id,
            name: opt._source.fulltitle,
            entry_seo: opt._source.entry_seo,
            xrated: opt._source.xrated,
        });
    }
    return suggestions;
};

router.get("/typeahead/:context/:query", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/typeahead/:context/:query",
        method: req.method,
        path: req.path,
    });
    const context = req.params.context.trim();
    const query = req.params.query.trim();

    logEvent(debug, {
        level: "info",
        event: "request.validated.pending",
        module: moduleId,
        route: "/typeahead/:context/:query",
        context,
        queryLen: query.length,
        xrt: req.query.xrt,
    });

    if (!["ALL", ...validContexts].includes(context)) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/typeahead/:context/:query",
            errMessage: "Context is invalid",
            context,
            status: 422,
        });
        return res.status(422).json({ error: "Context is invalid" });
    }
    if (query.length === 0) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/typeahead/:context/:query",
            errMessage: "Query must not be empty",
            status: 422,
        });
        return res.status(422).json({ error: "Query must not be empty" });
    }
    if (query.length > 100) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/typeahead/:context/:query",
            errMessage: "Query must not exceed 100 characters",
            status: 422,
        });
        return res.status(422).json({ error: "Query must not exceed 100 characters" });
    }

    try {
        const startedAt = Date.now();
        const result = await getTypeaheadSuggestions(context, query, req.query.xrt);

        const total = result?.hits?.total?.value ?? 0;
        res.header("X-Total-Count", total);
        const payload = prepareSuggestionsResponse(result);
        logEvent(debug, {
            level: "info",
            event: "request.response.sent",
            module: moduleId,
            route: "/typeahead/:context/:query",
            status: 200,
            total,
            returned: payload.length,
            durationMs: Date.now() - startedAt,
        });
        res.send(payload);
    } catch (err) {
        logEvent(debugError, {
            level: "error",
            event: "request.error",
            module: moduleId,
            route: "/typeahead/:context/:query",
            errType: err.name,
            errMessage: err.message,
            status: 500,
        });
        res.status(500).end();
    }
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

export default router;
