import debugLib from "debug";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "helperSearch";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);

const sourceIncludes = [
    "title", "xrated", "originalYearOfRelease", "machineType", "genre",
    "authors.name", "publishers.name",
];

const ZXRenderFlatOutputEntries = (r) => {
    const MAX_LENGTH = 32;
    const ellipsis = (x) => {
        const s = x.substring(0, MAX_LENGTH);
        return s.length === MAX_LENGTH ? s.substring(0, MAX_LENGTH - 3) + "..." : s;
    };
    
    debug(`renderFlatOutputEntries()`);
    let result = "r=" + (r?.hits?.total?.value ?? 0) + "\n";
    
    if (r?.hits?.hits) {
        for (const item of r.hits.hits) {
            result += "t=" + ellipsis(item._source.title) + "\n";
            
            let p = "";
            if (item._source.publishers) {
                for (const pub of item._source.publishers) {
                    p += pub.name + ",";
                }
                p = p.substring(0, p.length - 1);
            }
            result += "p=" + ellipsis(p) + "\n";
            
            let a = "";
            if (item._source.authors) {
                for (const author of item._source.authors) {
                    a += author.name + ",";
                }
                a = a.substring(0, a.length - 1);
            }
            result += "a=" + ellipsis(a) + "\n";
            
            result += "y=" + (item._source.originalYearOfRelease ? item._source.originalYearOfRelease + "\n" : "\n");
            result += "m=" + (item._source.machineType ? item._source.machineType + "\n" : "\n");
            result += "g=" + (item._source.genre ? item._source.genre + "\n" : "\n");
            result += "-\n";
        }
    }
    result += result.length;
    return result;
};

const ZXSearchEntries = async (q, pageSize, offset, sortObject, res) => {
    debug(`searchEntries()`);
    debug(`\tsize: ${pageSize}`);
    debug(`\toffset: ${offset}`);
    debug(`\tsort object: ${sortObject}`);

    const fromOffset = pageSize * offset;
    try {
        const result = await elasticClient.search({
            _source_includes: sourceIncludes,
            _source_excludes: "titlesuggest, metadata_author,authorsuggest",
            index: config.index_entries,
            body: {
                track_scores: true,
                size: pageSize,
                from: fromOffset,
                query: q,
                sort: sortObject,
            },
        });

        debug(`########### RESPONSE from elasticsearch`);
        debug(result);
        debug(`#############################################################`);

        res.header("X-Total-Count", result.hits.total.value);
        res.send(ZXRenderFlatOutputEntries(result));
    } catch (err) {
        debug(`[FAILED] ${err.message}`);
        res.status(500).end();
    }
};

export { ZXSearchEntries };
