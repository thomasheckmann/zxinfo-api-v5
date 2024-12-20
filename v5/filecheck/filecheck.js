/**
 * Lookup entry by md5 (32) or sha512 (128) hash
 *
 * http://localhost:3000/v5/filecheck/82bb33587530d337323ef3cd4456d4c4
 * or
 * http://localhost:3000/v5/filecheck/d4792184f2e471c4cc38e6f1f234ab4276c537224d2ca2f19f0b36695afc9a03ac4fb5dd4afdf549384725a91901221de825867627fac019ef0f5e033561f3a4
 *
 */

const moduleId = "filecheck";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const tools = require("../common/utils");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

var hashLookup = function (hash) {
    debug(`md5lookup() : ${hash}`);

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

router.get("/filecheck/:hash", (req, res) => {
    debug("==> /filecheck");
    debug(`\thash: ${req.params.hash}`);

    if (req.params.hash.length !== 32 && req.params.hash.length !== 128) {
        debug(`\tNOT a hash (length = 32 or 128)`);
        res.status(422).end();
        return;
    }

    hashLookup(req.params.hash).then(
        function (result) {
            debug(`########### RESPONSE from hashLookup(${req.params.hash})`);
            debug(result);
            debug(`#############################################################`);
            res.header("X-Total-Count", result.hits.total.value);

            if (result.hits.total.value === 0) {
                res.status(404).end();
            } else {
                const md5hash = result.hits.hits[0]._source.md5hash;
                // const sha512 = result.hits.hits[0]._source.sha512;

                var entry = {};
                entry.entry_id = result.hits.hits[0]._id;
                entry.title = result.hits.hits[0]._source.title;
                entry.zxinfoVersion = result.hits.hits[0]._source.zxinfoVersion;
                entry.contentType = result.hits.hits[0]._source.contentType;
                entry.originalYearOfRelease = result.hits.hits[0]._source.originalYearOfRelease;
                entry.machineType = result.hits.hits[0]._source.machineType;
                entry.genre = result.hits.hits[0]._source.genre;
                entry.genreType = result.hits.hits[0]._source.genreType;
                entry.genreSubType = result.hits.hits[0]._source.genreSubType;
                entry.publishers = result.hits.hits[0]._source.publishers;

                // 82055e3fcd911c98dd3193ae3fa486cf530cfdad154523ce17c73fe54a9d1c6c9c0c55f506aa0daaf7cb7b07c3169a44ff92fbaffe078686e1ccddaa215f198b
                // Exists in two different sources with different filenames
                var picked;
                if (req.params.hash.length == 32) picked = md5hash.filter((o) => o.md5 === req.params.hash);
                if (req.params.hash.length == 128) picked = md5hash.filter((o) => o.sha512 === req.params.hash);

                entry.file = picked;
                res.send(entry);
                // res.send({ entry_id: entry_id, title: title, file: picked });
            }
        },
        function (reason) {
            debug(`[FAILED] reason: ${reason.message}`);
            if (reason.message === "Not Found") {
                res.status(404).end();
            } else {
                res.status(500).end();
            }
        }
    );
});

router.use(function (req, res, next) {
    debug(`FILECHECK: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    helpers.defaultRouter(moduleId, debug, req, res, next);
});

module.exports = router;