import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "filesearch";
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
 * Full-text search across indexed .txt and .pdf document content in the zxdb_doc index.
 * Returns matching documents with highlighted content snippets.
 * Excludes file metadata timestamps from the response to reduce payload size.
 *
 * @param {string} text - The search term to match against document content.
 * @param {number} offset - Zero-based starting position (page * size).
 * @param {number} size - Number of results to return (1–100).
 */
const searchDoc = (text, offset, size) => {
    logEvent(debugTrace, {
        level: "trace",
        event: "request.search.query",
        module: moduleId,
        textLen: text.length,
        offset,
        size,
    });
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
    logEvent(debugTrace, {
        level: "trace",
        event: "request.entry.lookup",
        module: moduleId,
        checksum,
    });
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
    logEvent(debug, {
        level: "info",
        event: "request.start",
        module: moduleId,
        route: "/filesearch/:text",
        method: req.method,
        path: req.path,
    });

    const text = req.params.text.trim();
    if (text.length === 0) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/filesearch/:text",
            errMessage: "Search text must not be empty",
            status: 422,
        });
        return res.status(422).json({ error: "Search text must not be empty" });
    }
    if (text.length > 200) {
        logEvent(debugError, {
            level: "error",
            event: "request.validation.failed",
            module: moduleId,
            route: "/filesearch/:text",
            errMessage: "Search text must not exceed 200 characters",
            status: 422,
        });
        return res.status(422).json({ error: "Search text must not exceed 200 characters" });
    }

    const pg = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 30));
    const offset = pg * size;

    logEvent(debug, {
        level: "info",
        event: "request.validated",
        module: moduleId,
        route: "/filesearch/:text",
        textLen: text.length,
        offset,
        size,
    });

    try {
        const startedAt = Date.now();
        const result = await searchDoc(text, offset, size);
        res.header("X-Total-Count", result.hits.total.value);
        logEvent(debug, {
            level: "info",
            event: "request.search.executed",
            module: moduleId,
            route: "/filesearch/:text",
            total: result.hits.total.value,
            durationMs: Date.now() - startedAt,
        });

        if (result.hits.total.value === 0) {
            logEvent(debug, {
                level: "info",
                event: "request.response.sent",
                module: moduleId,
                route: "/filesearch/:text",
                status: 404,
                total: 0,
            });
            return res.status(404).end();
        }

        const docsFound = result.hits.hits;
        for (let i = 0; i < docsFound.length; i++) {
            const entryObj = await lookupHash(docsFound[i]._source.file.checksum);
            if (!entryObj.hits.hits[0]) {
                logEvent(debugError, {
                    level: "error",
                    event: "request.missing-entry",
                    module: moduleId,
                    route: "/filesearch/:text",
                    filename: docsFound[i]._source.file.filename,
                    checksum: docsFound[i]._source.file.checksum,
                });
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
        logEvent(debug, {
            level: "info",
            event: "request.response.sent",
            module: moduleId,
            route: "/filesearch/:text",
            status: 200,
            total: docsFound.length,
        });
        res.send(docsFound);
    } catch (err) {
        const status = err.message === "Not Found" ? 404 : 500;
        logEvent(debugError, {
            level: "error",
            event: "request.error",
            module: moduleId,
            route: "/filesearch/:text",
            errType: err.name,
            errMessage: err.message,
            status,
        });
        res.status(status).end();
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
