import debugLib from "debug";

import { elasticClient, config } from "../common/elastic.js";
import { es_source_list, renderFlatOutputEntries, renderSimpleOutput } from "../common/utils.js";

const moduleId = "helperSearch";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);

const shouldIncludeAggregations = (includeAgg) => (
    includeAgg === true || includeAgg === 1 || includeAgg === "true" || includeAgg === "1"
);

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
