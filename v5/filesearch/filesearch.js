const moduleId = "filesearch";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const { elasticClient, config, isDevelopment } = require("../common/elastic");

var searchDoc = function (text, offset, size) {
    debug(`searchDoc() : ${text}`);

    return elasticClient.search({
        _source: {
            includes: ["_id", "highlight", "file", "file.url"],
            excludes: ["file.created", "file.last_modified", "file.last_accessed", "file.indexing_date"]
        },
        index: "zxdb_doc",
        body: {
            size: size,
            from: offset,
            query: {
                match: {
                    content: text
                },
            },
            highlight: {
                pre_tags: ["<b>"],
                post_tags: ["</b>"],
                fields: { content: {} }
            }
        },
    });
};

var lookupHash = function (checksum) {
    debug(`lookupHash() : ${checksum}`);
    return elasticClient.search({
        _source_includes: ["_id", "title", "zxinfoVersion", "contentType", "originalYearOfRelease", "machineType", "genre", "genreType", "genreSubType", "publishers.name", "md5hash"],
        _source_excludes: ["titlesuggest", "publishersuggest", "authorsuggest", "metadata_author", "metadata_publisher"],
        index: config.index_entries,
        body: {
            query: {
                term: {
                    "md5hash.sha512": checksum
                },
            },
        },
    });
}

router.get("/filesearch/:text", (req, res) => {
    debug("==> /filesearch");
    debug(`\ttext: ${req.params.text}`);

    if (req.params.text.length <= 0) {
        debug(`\tcan't search for nothing?)`);
        res.status(422).end();
        return;
    }

    const pg = isNaN(req.query.offset) ? 0 : req.query.offset;
    const size = isNaN(req.query.size) ? 30 : req.query.size;

    const offset = pg * size;
    
    debug(`\toffset: ${offset}`);
    debug(`\tsize: ${size}`);

    searchDoc(req.params.text, offset, size).then(
        async function (result) {
            debug(`########### RESPONSE from filesearch(${req.params.text})`);
            debug(result);
            debug(`#############################################################`);
            res.header("X-Total-Count", result.hits.total.value);
            debug(`X-Total-Count: ${result.hits.total.value}`);

            if (result.hits.total.value === 0) {
                res.status(404).end();
            } else {
                const docsFound = result.hits.hits;
                debug(`docsFound: ${docsFound.length}`);
                for (let i = 0; i < docsFound.length; i++) {
                    // console.log(`Lookup: ${docsFound[i]._source.file.filename}: ${docsFound[i]._source.file.checksum}`);
                    const entryObj = await lookupHash(docsFound[i]._source.file.checksum);
                    if (!entryObj.hits.hits[0]) {
                        console.error(`[NOT FOUND] ${docsFound[i]._source.file.filename}\n${JSON.stringify(docsFound[i], null, 2)}`);
                    };
                    const sha512 = docsFound[i]._source.file.checksum;
                    const filename = docsFound[i]._source.file.filename;
                    const details = {
                        entryId: entryObj.hits.hits[0] ? entryObj.hits.hits[0]._id : "N/A",
                        title: entryObj.hits.hits[0] ? entryObj.hits.hits[0]._source.title : "N/A",
                        machineType: entryObj.hits.hits[0] ? entryObj.hits.hits[0]._source.machineType : "N/A",
                        contenttype: "",
                        source: ""
                    };

                    // lookup file with filename & sha512
                    var fileObj = entryObj.hits.hits[0] && entryObj.hits.hits[0]._source.md5hash.find(obj => {
                        return obj.filename === filename && obj.sha512 === sha512;
                    })
                    if (fileObj) {
                        details.contenttype = fileObj.contenttype;
                        details.source = fileObj.source;
                    }
                    docsFound[i].entry = details;
                }
                res.send(docsFound);
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
    debug(`FILESEARCH: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    helpers.defaultRouter(moduleId, debug, req, res, next);
});

module.exports = router;