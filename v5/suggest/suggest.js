import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "suggest";
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
 * Returns only unique items from array `a`, comparing by property `param`.
 *
 * @param {Object[]} a - Array to deduplicate.
 * @param {string} param - Property name to compare uniqueness on.
 */
function uniq(a, param) {
    return a.filter((item, pos, array) =>
        array.map((mapItem) => mapItem[param]).indexOf(item[param]) === pos
    );
}

/**
 * Queries Elasticsearch completion suggesters for titles, authors, and publishers
 * matching the given query string.
 *
 * @param {string} query - Partial text to complete.
 */
const getSuggestions = (query) =>
    elasticClient.search({
        index: config.index_entries,
        body: {
            suggest: {
                text: query,
                titles: { completion: { field: "titlesuggest", skip_duplicates: true, size: 8 } },
                authors: { completion: { field: "authorsuggest", skip_duplicates: true, size: 8 } },
                publishers: { completion: { field: "publishersuggest", skip_duplicates: false, size: 10 } },
            },
        },
    });

/**
 * Transforms raw Elasticsearch completion results into a flat, sorted suggestion list
 * combining titles (with entry_id/type), authors, and publishers.
 * Deduplicates authors and publishers by display text.
 *
 * @param {Object} result - Raw Elasticsearch response.
 * @returns {Object[]} Combined and deduplicated suggestion items.
 */
const prepareSuggestions = (result) => {
    const suggestions = [];

    for (const opt of result.suggest.titles[0].options) {
        suggestions.push({
            text: opt._source.title,
            labeltype: "",
            type: opt._source.contentType,
            entry_id: opt._id,
        });
    }

    let autSuggestions = result.suggest.authors[0].options.map((opt) => {
        const names = opt._source.metadata_author;
        let output = opt.text;
        let labeltype = "";
        for (const n of names) {
            if (n.alias.indexOf(opt.text) > -1) {
                output = n.name;
                labeltype = n.labeltype ?? "";
            }
        }
        return { text: output, labeltype, type: "AUTHOR" };
    });

    let pubSuggestions = result.suggest.publishers[0].options.map((opt) => {
        const names = opt._source.metadata_publisher;
        let name = opt.text;
        let labeltype = "";
        for (const n of names) {
            if (n.suggest.indexOf(opt.text) > -1) {
                name = n.name;
                labeltype = n.labeltype ?? "";
            }
        }
        return { text: name, labeltype, type: "PUBLISHER" };
    });

    autSuggestions = uniq(autSuggestions, "text");
    pubSuggestions = uniq(pubSuggestions, "text");
    suggestions.push(...autSuggestions, ...pubSuggestions);
    suggestions.sort((a, b) => a.output - b.output);
    return suggestions;
};

/**
 * Queries the author completion suggester for names starting with the given prefix.
 *
 * @param {string} name - Partial author name to complete.
 */
const getAuthorSuggestions = (name) =>
    elasticClient.search({
        index: config.index_entries,
        body: {
            suggest: {
                text: name,
                authors: { completion: { field: "authorsuggest", skip_duplicates: true, size: 10 } },
            },
        },
    });

/**
 * Resolves raw author completion results to canonical author names,
 * matching against known aliases. Deduplicates and sorts the output.
 *
 * @param {Object} result - Raw Elasticsearch response.
 * @returns {Object[]} Deduplicated list of { text, labeltype } author suggestions.
 */
const prepareAuthorSuggestions = (result) => {
    const suggestions = result.suggest.authors[0].options.map((opt) => {
        const names = opt._source.metadata_author;
        let output = opt.text;
        let labeltype = "";
        for (const n of names) {
            if (n.alias.indexOf(opt.text) > -1) {
                output = n.name;
                labeltype = n.labeltype ?? "";
            }
        }
        return { text: output, labeltype };
    });
    suggestions.sort((a, b) => a.output - b.output);
    return uniq(suggestions, "text");
};

/**
 * Queries the publisher completion suggester for names starting with the given prefix.
 *
 * @param {string} name - Partial publisher name to complete.
 */
const getPublisherSuggestions = (name) =>
    elasticClient.search({
        index: config.index_entries,
        body: {
            suggest: {
                text: name,
                publishers: { completion: { field: "publishersuggest", skip_duplicates: false, size: 10 } },
            },
        },
    });

/**
 * Resolves raw publisher completion results to canonical publisher names,
 * matching against known suggest aliases. Deduplicates and sorts the output.
 *
 * @param {Object} result - Raw Elasticsearch response.
 * @returns {Object[]} Deduplicated list of { text, labeltype } publisher suggestions.
 */
const preparePublisherSuggestions = (result) => {
    const suggestions = result.suggest.publishers[0].options.map((opt) => {
        const names = opt._source.metadata_publisher;
        let name = opt.text;
        let labeltype = "";
        for (const n of names) {
            if (n.suggest.indexOf(opt.text) > -1) {
                name = n.name;
                labeltype = n.labeltype ?? "";
            }
        }
        return { text: name, labeltype };
    });
    suggestions.sort((a, b) => a.output - b.output);
    return uniq(suggestions, "text");
};

router.get("/suggest/:query", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/suggest/:query",
        method: req.method,
        path: req.path,
    });
    const query = req.params.query.trim();
    if (query.length === 0) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/suggest/:query",
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
            route: "/suggest/:query",
            errMessage: "Query must not exceed 100 characters",
            status: 422,
        });
        return res.status(422).json({ error: "Query must not exceed 100 characters" });
    }
    try {
        const startedAt = Date.now();
        const result = await getSuggestions(query);
        const payload = prepareSuggestions(result);
        logEvent(debug, {
            level: "info",
            event: "request.response.sent",
            module: moduleId,
            route: "/suggest/:query",
            status: 200,
            total: payload.length,
            durationMs: Date.now() - startedAt,
        });
        logEvent(debugTrace, {
            level: "trace",
            event: "request.suggest.meta",
            module: moduleId,
            titles: result?.suggest?.titles?.[0]?.options?.length ?? 0,
            authors: result?.suggest?.authors?.[0]?.options?.length ?? 0,
            publishers: result?.suggest?.publishers?.[0]?.options?.length ?? 0,
        });
        res.send(payload);
    } catch (err) {
        logEvent(debugError, {
            level: "error",
            event: "request.error",
            module: moduleId,
            route: "/suggest/:query",
            errType: err.name,
            errMessage: err.message,
            status: 500,
        });
        res.status(500).end();
    }
});

router.get("/suggest/author/:name", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/suggest/author/:name",
        method: req.method,
        path: req.path,
    });
    const name = req.params.name.trim();
    if (name.length === 0) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/suggest/author/:name",
            errMessage: "Name must not be empty",
            status: 422,
        });
        return res.status(422).json({ error: "Name must not be empty" });
    }
    if (name.length > 100) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/suggest/author/:name",
            errMessage: "Name must not exceed 100 characters",
            status: 422,
        });
        return res.status(422).json({ error: "Name must not exceed 100 characters" });
    }
    try {
        const startedAt = Date.now();
        const result = await getAuthorSuggestions(name);
        const payload = prepareAuthorSuggestions(result);
        logEvent(debug, {
            level: "info",
            event: "request.response.sent",
            module: moduleId,
            route: "/suggest/author/:name",
            status: 200,
            total: payload.length,
            durationMs: Date.now() - startedAt,
        });
        res.send(payload);
    } catch (err) {
        logEvent(debugError, {
            level: "error",
            event: "request.error",
            module: moduleId,
            route: "/suggest/author/:name",
            errType: err.name,
            errMessage: err.message,
            status: 500,
        });
        res.status(500).end();
    }
});

router.get("/suggest/publisher/:name", async (req, res) => {
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/suggest/publisher/:name",
        method: req.method,
        path: req.path,
    });
    const name = req.params.name.trim();
    if (name.length === 0) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/suggest/publisher/:name",
            errMessage: "Name must not be empty",
            status: 422,
        });
        return res.status(422).json({ error: "Name must not be empty" });
    }
    if (name.length > 100) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/suggest/publisher/:name",
            errMessage: "Name must not exceed 100 characters",
            status: 422,
        });
        return res.status(422).json({ error: "Name must not exceed 100 characters" });
    }
    try {
        const startedAt = Date.now();
        const result = await getPublisherSuggestions(name);
        const payload = preparePublisherSuggestions(result);
        logEvent(debug, {
            level: "info",
            event: "request.response.sent",
            module: moduleId,
            route: "/suggest/publisher/:name",
            status: 200,
            total: payload.length,
            durationMs: Date.now() - startedAt,
        });
        res.send(payload);
    } catch (err) {
        logEvent(debugError, {
            level: "error",
            event: "request.error",
            module: moduleId,
            route: "/suggest/publisher/:name",
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
