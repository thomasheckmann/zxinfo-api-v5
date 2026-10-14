import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "magazines";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);
const debugError = debugLib(`zxinfo-api-v5:${moduleId}:error`);
const router = express.Router();
const index = config.index_magazines;

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

const getAllMagazines = (pageSize, offset) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "request.magazines.search.start",
    module: moduleId,
    index,
    pageSize,
    offset,
  });
  return elasticClient.search({
    index,
    body: {
      size: pageSize,
      from: offset * pageSize,
      _source: ["name", "publisher", "language", "country", "type"],
      query: {
        bool: {
          must: [{ match_all: {} }],
        },
      },
      sort: { "name.keyword": { order: "asc" } },
    },
  });
};

const getMagazineByName = (name) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "request.magazine.search.start",
    module: moduleId,
    index,
    name,
  });
  return elasticClient.search({
    index,
    body: {
      query: {
        bool: {
          must: [{ match: { name } }],
        },
      },
    },
  });
};

const getIssuesByMagazineName = (name) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "request.issues.search.start",
    module: moduleId,
    index,
    name,
  });
  return elasticClient.search({
    index,
    body: {
      _source: {
        includes: ["*"],
        excludes: ["issues.files.*", "issues.references.*"],
      },
      size: 1,
      from: 0,
      query: {
        bool: {
          must: [{ match: { "name.keyword": name } }],
        },
      },
    },
  });
};

const getIssue = (name, issueId) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "request.issue.search.start",
    module: moduleId,
    index,
    name,
    issueId,
  });
  return elasticClient.search({
    index,
    body: {
      _source: {
        includes: ["*"],
      },
      size: 1,
      from: 0,
      query: {
        bool: {
          must: [{ match: { name } }, { match: { "issues.id": issueId } }],
        },
      },
    },
  });
};

const sendSearchError = (res, err, route) => {
  const status = err.message === "Not Found" ? 404 : 500;
  logEvent(debugError, {
    level: "error",
    event: "request.error",
    module: moduleId,
    route,
    errType: err.name,
    errMessage: err.message,
    status,
  });
  return res.status(status).end();
};

router.use((req, res, next) => {
  console.log(`[magazines] ${req.method} ${req.originalUrl}`);
  logEvent(debug, {
    level: "info",
    event: "module.middleware",
    module: moduleId,
    path: req.path,
    method: req.method,
    userAgent: req.headers["user-agent"],
  });
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (!req.query.size) {
    req.query.size = 500;
  }
  defaultRouter(moduleId, debug, req, res, next);
});

router.get("/", async (req, res) => {
  const route = "/";
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route,
    method: req.method,
    path: req.path,
  });

  try {
    const startedAt = Date.now();
    const result = await getAllMagazines(req.query.size, req.query.offset);
    const total = result.hits.total.value;
    res.header("X-Total-Count", total);
    logEvent(debug, {
      level: "info",
      event: "request.search.executed",
      module: moduleId,
      route,
      total,
      durationMs: Date.now() - startedAt,
    });
    logEvent(debug, {
      level: "info",
      event: "request.response.sent",
      module: moduleId,
      route,
      status: 200,
      total,
    });
    return res.send(result);
  } catch (err) {
    return sendSearchError(res, err, route);
  }
});

router.get("/:name/issues/:issueId", async (req, res) => {
  const { name, issueId } = req.params;
  const route = "/:name/issues/:issueId";
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route,
    method: req.method,
    path: req.path,
    name,
    issueId,
  });

  try {
    const result = await getIssue(name, issueId);
    if (result.hits.hits.length === 0) {
      return res.status(404).end();
    }

    const hit = result.hits.hits[0];
    const source = hit._source;
    const issue = source.issues.filter((data) => data.id == issueId)[0];
    return res.send({
      magazine_id: hit._id,
      issue_id: issueId,
      name: source.name,
      publisher: source.publisher,
      type: source.type,
      country: source.country,
      language: source.language,
      link_mask: source.link_mask,
      archive_mask: source.archive_mask,
      issue,
    });
  } catch (err) {
    return sendSearchError(res, err, route);
  }
});

router.get("/:name/issues", async (req, res) => {
  const { name } = req.params;
  const route = "/:name/issues";
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route,
    method: req.method,
    path: req.path,
    name,
  });

  try {
    const result = await getIssuesByMagazineName(name);
    if (result.hits.hits.length === 0) {
      return res.status(404).end();
    }

    const source = result.hits.hits[0]._source;
    if (source.issues === undefined) {
      source.issues = [];
    }
    res.header("X-Total-Count", source.issues.length);
    return res.send(source);
  } catch (err) {
    return sendSearchError(res, err, route);
  }
});

router.get("/:name", async (req, res) => {
  const { name } = req.params;
  const route = "/:name";
  logEvent(debug, {
    level: "info",
    event: "request.start",
    module: moduleId,
    route,
    method: req.method,
    path: req.path,
    name,
  });

  try {
    const result = await getMagazineByName(name);
    if (result.hits.hits.length === 0) {
      return res.status(404).end();
    }
    return res.send(result.hits.hits[0]);
  } catch (err) {
    return sendSearchError(res, err, route);
  }
});

export default router;