import debugLib from "debug";

import { elasticClient, config } from "../common/elastic.js";
import { es_source_list, renderFlatOutputEntries, renderSimpleOutput } from "../common/utils.js";

const moduleId = "helperSearch";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);
const debugError = debugLib(`zxinfo-api-v5:${moduleId}:error`);

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
 * Normalizes the include-aggregations flag accepted by the API.
 * Treats boolean true, numeric 1, and string values "true" or "1" as enabled.
 *
 * @param {boolean|number|string|undefined} includeAgg - Raw include-aggregations value.
 * @returns {boolean} True when aggregations should be attached to the search body.
 */
const shouldIncludeAggregations = (includeAgg) => (
    includeAgg === true || includeAgg === 1 || includeAgg === "true" || includeAgg === "1"
);

/**
 * Executes a ZXDB entry search and writes the API response in the requested format.
 * Supports raw Elasticsearch output, normal JSON output, simple list output, and flat text output.
 *
 * @param {Object} query - Elasticsearch query definition.
 * @param {Object} aggregations - Elasticsearch aggregation definition.
 * @param {boolean|number|string|undefined} includeAgg - Whether to include aggregations.
 * @param {number} pageSize - Number of results per page.
 * @param {number} offset - Zero-based page number.
 * @param {Object|Object[]} sortObject - Elasticsearch sort definition.
 * @param {string} outputMode - Source field mode, such as compact or full.
 * @param {*} explain - When present, return the raw Elasticsearch response.
 * @param {string|undefined} output - Optional alternate output format.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<void>} Resolves when the HTTP response has been sent.
 */
const ZXSearchEntries = async (query, aggregations, includeAgg, pageSize, offset, sortObject, outputMode, explain, output, res) => {
    logEvent(debug, {
        level: "info",
        event: "search.execute.start",
        module: moduleId,
        size: pageSize,
        offset,
        sort: JSON.stringify(sortObject),
        mode: outputMode,
        includeAgg,
        output,
        explain: explain !== undefined,
    });

    const fromOffset = pageSize * offset;

    try {
        const startedAt = Date.now();
        const body = {
            track_scores: true,
            size: pageSize,
            from: fromOffset,
            query,
            sort: sortObject,
        };

        if (shouldIncludeAggregations(includeAgg)) {
            body.aggregations = aggregations;
        }

        const result = await elasticClient.search({
            _source_includes: es_source_list(outputMode, includeAgg),
            _source_excludes: "titlesuggest, metadata_author,authorsuggest",
            index: config.index_entries,
            body,
        });

        logEvent(debug, {
            level: "info",
            event: "search.execute.result",
            module: moduleId,
            total: result.hits.total.value,
            returned: result.hits.hits.length,
            durationMs: Date.now() - startedAt,
        });

        logEvent(debugTrace, {
            level: "trace",
            event: "search.execute.meta",
            module: moduleId,
            total: result.hits.total.value,
            hasAggregations: result.aggregations !== undefined,
        });

        if (explain !== undefined) {
            logEvent(debug, {
                level: "info",
                event: "search.response.sent",
                module: moduleId,
                status: 200,
                responseType: "raw",
            });
            res.send(result);
            return;
        }

        res.header("X-Total-Count", result.hits.total.value);

        if (output === "simple") {
            logEvent(debug, {
                level: "info",
                event: "search.response.sent",
                module: moduleId,
                status: 200,
                responseType: "simple",
            });
            res.send(renderSimpleOutput(result));
            return;
        }
        if (output === "flat") {
            res.header("content-type", "text/plain;charset=UTF-8");
            logEvent(debug, {
                level: "info",
                event: "search.response.sent",
                module: moduleId,
                status: 200,
                responseType: "flat",
            });
            res.send(renderFlatOutputEntries(result));
            return;
        }
        logEvent(debug, {
            level: "info",
            event: "search.response.sent",
            module: moduleId,
            status: 200,
            responseType: "json",
        });
        res.send(result);
    } catch (err) {
        logEvent(debugError, {
            level: "error",
            event: "search.execute.error",
            module: moduleId,
            errType: err.name,
            errMessage: err.message,
            status: 500,
        });
        res.status(500).end();
    }
};

export { ZXSearchEntries };
