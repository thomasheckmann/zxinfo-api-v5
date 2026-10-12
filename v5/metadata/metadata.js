import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { elasticClient, config } from "../common/elastic.js";

const moduleId = "metadata";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);
const debugError = debugLib(`zxinfo-api-v5:${moduleId}:error`);
const router = express.Router();

const logEvent = (logger, fields) => {
  const message = Object.entries(fields)
    .map(([key, value]) => {
      if (value === undefined || value === null) {
        return `${key}=n/a`;
      }
      const text = String(value);
      return `${key}=${text.includes(" ") ? JSON.stringify(text) : text}`;
    })
    .join(" ");
  logger(message);
};

const getMetadata = () => {
  logEvent(debugTrace, {
    level: "trace",
    event: "request.metadata.search.start",
    module: moduleId,
    index: config.index_entries,
  });
  return elasticClient.search({
    filter_path: "aggregations",
    index: config.index_entries,
    body: {
      size: 0,
      aggs: {
        featuretypes: {
          terms: {
            field: "features.name",
            size: 100,
            order: {
              _key: "asc",
            },
          },
        },
        machinetypes: {
          terms: {
            field: "machineType",
            size: 50,
            order: {
              _key: "desc",
            },
          },
        },
        genretypes: {
          terms: {
            field: "genreType",
            size: 50,
            order: {
              _key: "asc",
            },
          },
        },
      },
    },
  });
};

const processMetadata = (result) => {
  const metadata = {};
  const aggregations = result.aggregations;

  const machinetypes = { parameter: "machinetype", type: "S", values: [] };
  for (const bucket of aggregations.machinetypes.buckets) {
    machinetypes.values.push({ value: bucket.key, doc_count: bucket.doc_count });
  }
  metadata.machinetypes = machinetypes;

  const genretypes = { parameter: "genretype", type: "S", values: [] };
  for (const bucket of aggregations.genretypes.buckets) {
    genretypes.values.push({ value: bucket.key, doc_count: bucket.doc_count });
  }
  metadata.genretypes = genretypes;

  const features = { group: "F", type: "G", values: [] };
  for (const bucket of aggregations.featuretypes.buckets) {
    features.values.push({ groupname: bucket.key, doc_count: bucket.doc_count });
  }
  metadata.features = features;
  return metadata;
};

router.use((req, res, next) => {
  console.log(`[metadata] ${req.method} ${req.originalUrl}`);
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

router.get("/metadata", async (req, res) => {
  const route = "/metadata";
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
    const result = await getMetadata();
    const metadata = processMetadata(result);

    logEvent(debug, {
      level: "info",
      event: "request.search.executed",
      module: moduleId,
      route,
      durationMs: Date.now() - startedAt,
    });
    logEvent(debug, {
      level: "info",
      event: "request.response.sent",
      module: moduleId,
      route,
      status: 200,
    });
    return res.send(metadata);
  } catch (err) {
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
  }
});

export default router;