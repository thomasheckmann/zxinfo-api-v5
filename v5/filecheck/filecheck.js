import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "filecheck";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);
const debugError = debugLib(`zxinfo-api-v5:${moduleId}:error`);
const router = express.Router();

const MD5_LENGTH = 32;
const SHA512_LENGTH = 128;

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

const normalizeHash = (rawHash) => {
  const hash = String(rawHash ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]+$/i.test(hash)) {
    return null;
  }
  if (hash.length !== MD5_LENGTH && hash.length !== SHA512_LENGTH) {
    return null;
  }
  return hash;
};

const getHashType = (hash) => {
  if (hash.length === MD5_LENGTH) {
    return "md5";
  }
  if (hash.length === SHA512_LENGTH) {
    return "sha512";
  }
  return "unknown";
};

const hashLookup = (hash) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "request.entry.lookup",
    module: moduleId,
    hashType: getHashType(hash),
    hashLen: hash.length,
  });
  return elasticClient.search({
    _source_includes: ["_id", "title", "zxinfoVersion", "contentType", "originalYearOfRelease", "machineType", "genre", "genreType", "genreSubType", "publishers.name", "md5hash"],
    _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
    index: config.index_entries,
    body: {
      query: {
        multi_match: {
          query: hash,
          fields: ["md5hash.md5", "md5hash.sha512"],
        },
      },
    },
  });
};

const pickMatchingFiles = (files, hash) => {
  if (!Array.isArray(files)) {
    return [];
  }
  if (hash.length === MD5_LENGTH) {
    return files.filter((file) => file.md5 === hash);
  }
  return files.filter((file) => file.sha512 === hash);
};

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

router.get("/filecheck/:hash", async (req, res) => {
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route: "/filecheck/:hash",
    method: req.method,
    path: req.path,
  });

  const hash = normalizeHash(req.params.hash);
  if (hash === null) {
    logEvent(debugError, {
      level: "error",
      event: "request.validation.failed",
      module: moduleId,
      route: "/filecheck/:hash",
      errMessage: "Hash must be a 32-char md5 or 128-char sha512 hex string",
      status: 422,
    });
    return res.status(422).json({ error: "Hash must be a 32-char md5 or 128-char sha512 hex string" });
  }

  logEvent(debug, {
    level: "info",
    event: "request.validated",
    module: moduleId,
    route: "/filecheck/:hash",
    hashType: getHashType(hash),
    hashLen: hash.length,
  });

  try {
    const startedAt = Date.now();
    const result = await hashLookup(hash);
    const total = result.hits.total.value;
    res.header("X-Total-Count", total);

    logEvent(debug, {
      level: "info",
      event: "request.search.executed",
      module: moduleId,
      route: "/filecheck/:hash",
      hashType: getHashType(hash),
      total,
      durationMs: Date.now() - startedAt,
    });

    if (total === 0) {
      logEvent(debug, {
        level: "info",
        event: "request.response.sent",
        module: moduleId,
        route: "/filecheck/:hash",
        status: 404,
        total,
      });
      return res.status(404).end();
    }

    const source = result.hits.hits[0]._source;
    const entry = {
      entry_id: result.hits.hits[0]._id,
      title: source.title,
      zxinfoVersion: source.zxinfoVersion,
      contentType: source.contentType,
      originalYearOfRelease: source.originalYearOfRelease,
      machineType: source.machineType,
      genre: source.genre,
      genreType: source.genreType,
      genreSubType: source.genreSubType,
      publishers: source.publishers,
      file: pickMatchingFiles(source.md5hash, hash),
    };

    logEvent(debug, {
      level: "info",
      event: "request.response.sent",
      module: moduleId,
      route: "/filecheck/:hash",
      status: 200,
      total,
      returned: 1,
      matchedFiles: entry.file.length,
    });
    return res.send(entry);
  } catch (err) {
    const status = err.message === "Not Found" ? 404 : 500;
    logEvent(debugError, {
      level: "error",
      event: "request.error",
      module: moduleId,
      route: "/filecheck/:hash",
      errType: err.name,
      errMessage: err.message,
      status,
    });
    return res.status(status).end();
  }
});

export default router;
