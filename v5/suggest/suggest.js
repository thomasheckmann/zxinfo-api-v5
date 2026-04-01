import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "suggest";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const router = express.Router();

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
    debug("==> /suggest/:query");
    const query = req.params.query.trim();
    if (query.length === 0) {
        return res.status(422).json({ error: "Query must not be empty" });
    }
    if (query.length > 100) {
        return res.status(422).json({ error: "Query must not exceed 100 characters" });
    }
    try {
        const result = await getSuggestions(query);
        debug(result);
        res.send(prepareSuggestions(result));
    } catch (err) {
        debug(`[FAILED] getSuggestions: ${err.message}`);
        res.status(500).end();
    }
});

router.get("/suggest/author/:name", async (req, res) => {
    debug("==> /suggest/author/:name");
    const name = req.params.name.trim();
    if (name.length === 0) {
        return res.status(422).json({ error: "Name must not be empty" });
    }
    if (name.length > 100) {
        return res.status(422).json({ error: "Name must not exceed 100 characters" });
    }
    try {
        const result = await getAuthorSuggestions(name);
        debug(result);
        res.send(prepareAuthorSuggestions(result));
    } catch (err) {
        debug(`[FAILED] getAuthorSuggestions: ${err.message}`);
        res.status(500).end();
    }
});

router.get("/suggest/publisher/:name", async (req, res) => {
    debug("==> /suggest/publisher/:name");
    const name = req.params.name.trim();
    if (name.length === 0) {
        return res.status(422).json({ error: "Name must not be empty" });
    }
    if (name.length > 100) {
        return res.status(422).json({ error: "Name must not exceed 100 characters" });
    }
    try {
        const result = await getPublisherSuggestions(name);
        debug(result);
        res.send(preparePublisherSuggestions(result));
    } catch (err) {
        debug(`[FAILED] getPublisherSuggestions: ${err.message}`);
        res.status(500).end();
    }
});

router.use((req, res, next) => {
    debug(`SUGGEST: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);
    defaultRouter(moduleId, debug, req, res, next);
});

export default router;
