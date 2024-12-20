const moduleId = "metadata";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const tools = require("../common/utils");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

var getMetaData = function (name) {
    debug("getMetadata()");
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

/*
 * [{name: "features", group_id: "F", group_name: "Features", values: [{key: "F1", doc_count: 111}, {key: "F1", doc_count: 111}]
 *
 */
var processMetaData = function (result) {
    debug("processMetaData()");
    var metadata = {};

    // iterate machinetypes
    var machinetypes = { parameter: "machinetype", type: "S", values: [] };
    for (const machinetype in result.aggregations.machinetypes.buckets) {
        var value = result.aggregations.machinetypes.buckets[machinetype].key;
        var doc_count = result.aggregations.machinetypes.buckets[machinetype].doc_count;

        machinetypes.values.push({ value: value, doc_count: doc_count });
    }
    metadata.machinetypes = machinetypes;

    // iterate genretypes
    var genretypes = { parameter: "genretype", type: "S", values: [] };
    for (const genretype in result.aggregations.genretypes.buckets) {
        var value = result.aggregations.genretypes.buckets[genretype].key;
        var doc_count = result.aggregations.genretypes.buckets[genretype].doc_count;

        genretypes.values.push({ value: value, doc_count: doc_count });
    }
    metadata.genretypes = genretypes;

    // iterate features
    var features = { group: "F", type: "G", values: [] };
    for (const feature in result.aggregations.featuretypes.buckets) {
        var groupname = result.aggregations.featuretypes.buckets[feature].key;
        var doc_count = result.aggregations.featuretypes.buckets[feature].doc_count;

        features.values.push({ groupname: groupname, doc_count: doc_count });
    }
    metadata.features = features;
    return metadata;
};

router.get("/metadata", function (req, res, next) {
    debug("==> /metadata");
    getMetaData(null).then(function (result) {
        res.send(processMetaData(result));
        //res.send(result);
    });
});


router.use(function (req, res, next) {
    debug(`METADATA: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    helpers.defaultRouter(moduleId, debug, req, res, next);
});

module.exports = router;