import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "filesearch";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const router = express.Router();

/**
 * Full-text search across indexed .txt and .pdf document content in the zxdb_doc index.
 * Returns matching documents with highlighted content snippets.
 * Excludes file metadata timestamps from the response to reduce payload size.
 *
 * @param {string} text - The search term to match against document content.
 * @param {number} offset - Zero-based starting position (page * size).
 * @param {number} size - Number of results to return (1–100).
 */
const searchDoc = (text, offset, size) => {
    debug(`searchDoc() : ${text}`);
    return elasticClient.search({
        _source: {
            includes: ["_id", "highlight", "file", "file.url"],
            excludes: ["file.created", "file.last_modified", "file.last_accessed", "file.indexing_date"],
        },
        index: "zxdb_doc",
        body: {
            size,
            from: offset,
            query: { match: { content: text } },
            highlight: {
                pre_tags: ["<b>"],
                post_tags: ["</b>"],
                fields: { content: {} },
            },
        },
    });
};

/**
 * Looks up a ZXDB entry by its file SHA-512 checksum.
 * Used to enrich each search result document with the associated game/software entry.
 * Returns entry metadata including title, machine type, publishers, and file hashes.
 *
 * @param {string} checksum - SHA-512 hash of the file to look up.
 */
const lookupHash = (checksum) => {
    debug(`lookupHash() : ${checksum}`);
    return elasticClient.search({
        _source_includes: ["_id", "title", "zxinfoVersion", "contentType", "originalYearOfRelease", "machineType", "genre", "genreType", "genreSubType", "publishers.name", "md5hash"],
        _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
        index: config.index_entries,
        body: {
            query: { term: { "md5hash.sha512": checksum } },
        },
    });
};

/**
 * GET /filesearch/:text
 *
 * Searches indexed document content (txt/pdf files known to ZXDB) for the given text.
 * Each matching document is enriched with the associated ZXDB entry looked up by file checksum.
 *
 * Query params:
 *   offset {number} - Page number (0-based), default 0
 *   size   {number} - Results per page (1–100), default 30
 *
 * Responses:
 *   200 - Array of matching documents, each with an `entry` property
 *   404 - No documents found
 *   422 - Invalid input (empty or too-long search text)
 *   500 - Elasticsearch error
 */
router.get("/filesearch/:text", async (req, res) => {
    debug("==> /filesearch");
    debug(`\ttext: ${req.params.text}`);

    const text = req.params.text.trim();
    if (text.length === 0) {
        return res.status(422).json({ error: "Search text must not be empty" });
    }
    if (text.length > 200) {
        return res.status(422).json({ error: "Search text must not exceed 200 characters" });
    }

    const pg = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 30));
    const offset = pg * size;

    debug(`\toffset: ${offset}`);
    debug(`\tsize: ${size}`);

    try {
        const result = await searchDoc(text, offset, size);
        res.header("X-Total-Count", result.hits.total.value);

        if (result.hits.total.value === 0) {
            return res.status(404).end();
        }

        const docsFound = result.hits.hits;
        for (let i = 0; i < docsFound.length; i++) {
            const entryObj = await lookupHash(docsFound[i]._source.file.checksum);
            if (!entryObj.hits.hits[0]) {
                console.error(`[NOT FOUND] ${docsFound[i]._source.file.filename}\n${JSON.stringify(docsFound[i], null, 2)}`);
            }
            const sha512 = docsFound[i]._source.file.checksum;
            const filename = docsFound[i]._source.file.filename;
            const entry = entryObj.hits.hits[0];
            const details = {
                entryId: entry ? entry._id : "N/A",
                title: entry ? entry._source.title : "N/A",
                machineType: entry ? entry._source.machineType : "N/A",
                contenttype: "",
                source: "",
            };
            const fileObj = entry && entry._source.md5hash.find(
                (obj) => obj.filename === filename && obj.sha512 === sha512
            );
            if (fileObj) {
                details.contenttype = fileObj.contenttype;
                details.source = fileObj.source;
            }
            docsFound[i].entry = details;
        }
        res.send(docsFound);
    } catch (err) {
        debug(`[FAILED] reason: ${err.message}`);
        res.status(err.message === "Not Found" ? 404 : 500).end();
    }
});

router.use((req, res, next) => {
    debug(`FILESEARCH: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);
    defaultRouter(moduleId, debug, req, res, next);
});

export default router;
