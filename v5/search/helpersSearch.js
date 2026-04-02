import debugLib from "debug";

import { elasticClient, config } from "../common/elastic.js";
import { es_source_list, renderFlatOutputEntries, renderSimpleOutput } from "../common/utils.js";

const moduleId = "helperSearch";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);

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
    debug("searchEntries()");
    debug(`\tsize: ${pageSize}`);
    debug(`\toffset: ${offset}`);
    debug(`\tsort object: ${sortObject}`);
    debug(`\tmode: ${outputMode}`);

    const fromOffset = pageSize * offset;

    try {
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

        debug("########### RESPONSE from elasticsearch");
        debug(result);
        debug("#############################################################");

        if (explain !== undefined) {
            res.send(result);
            return;
        }

        res.header("X-Total-Count", result.hits.total.value);

        if (output === "simple") {
            res.send(renderSimpleOutput(result));
            return;
        }
        if (output === "flat") {
            res.header("content-type", "text/plain;charset=UTF-8");
            res.send(renderFlatOutputEntries(result));
            return;
        }
        res.send(result);
    } catch (err) {
        debug(`[FAILED] ${err.message}`);
        res.status(500).end();
    }
};

export { ZXSearchEntries };
