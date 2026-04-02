import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "typeahead";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const router = express.Router();

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

    debug(`context: ${context}`);
    debug(`includeXrated: ${includeXrated} (from xrt=${xrt})`);

    let contextFilter = {};
    if (!includeXrated) {
        expandedContext = context === "ALL" ? "ALL_false" : `${context}_false`;
        contextFilter = { genre_xrated: `${expandedContext}` };
        debug(`expandedContext (HIDE xrated): ${expandedContext}`);
    } else {
        contextFilter = { genre: expandedContext };
        debug(`expandedContext (SHOW xrated): ${expandedContext}`);
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
    debug(`No of suggestions: ${options.length}`);

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
    debug("==> /typeahead/:context/:query");
    const context = req.params.context.trim();
    const query = req.params.query.trim();

    debug(`\tcontext: ${context}`);
    debug(`\tquery: ${query}`);
    debug(`\txrt: ${req.query.xrt}`);

    if (!["ALL", ...validContexts].includes(context)) {
        debug(`[INVALID] context: ${context}`);
        return res.status(422).json({ error: "Context is invalid" });
    }
    if (query.length === 0) {
        return res.status(422).json({ error: "Query must not be empty" });
    }
    if (query.length > 100) {
        return res.status(422).json({ error: "Query must not exceed 100 characters" });
    }

    try {
        const result = await getTypeaheadSuggestions(context, query, req.query.xrt);
        debug(result);

        const total = result?.hits?.total?.value ?? 0;
        res.header("X-Total-Count", total);
        res.send(prepareSuggestionsResponse(result));
    } catch (err) {
        debug(`[FAILED] getTypeaheadSuggestions: ${err.message}`);
        res.status(500).end();
    }
});

router.use((req, res, next) => {
    debug(`TYPEAHEAD: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);
    defaultRouter(moduleId, debug, req, res, next);
});

export default router;
