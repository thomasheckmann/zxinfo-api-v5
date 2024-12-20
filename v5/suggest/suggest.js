const moduleId = "suggest";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const tools = require("../common/utils");
const queryHelper = require("../common/queryTerms");
const search = require("../common/helpersSearch");
const helpers = require("../common/helpersRequest");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

/* GET title suggestions for completion (all) */
var getSuggestions = function (query) {
    return elasticClient.search({
        index: config.index_entries,
        body: {
            suggest: {
                text: query,
                titles: {
                    completion: {
                        field: "titlesuggest",
                        skip_duplicates: true,
                        size: 8,
                    },
                },
                authors: {
                    completion: {
                        field: "authorsuggest",
                        skip_duplicates: true,
                        size: 8,
                    },
                },
                publishers: {
                    completion: {
                        field: "publishersuggest",
                        skip_duplicates: false,
                        size: 10,
                    },
                },
            },
        },
    });
};

var prepareSuggestions = function (result) {
    function uniq(a, param) {
        return a.filter(function (item, pos, array) {
            return (
                array
                    .map(function (mapItem) {
                        return mapItem[param];
                    })
                    .indexOf(item[param]) === pos
            );
        });
    }

    var suggestons = [];

    // iterate titles
    var i = 0;
    for (; i < result.suggest.titles[0].options.length; i++) {
        var item = {
            text: result.suggest.titles[0].options[i]._source.title,
            labeltype: "",
            type: result.suggest.titles[0].options[i]._source.contentType,
            entry_id: result.suggest.titles[0].options[i]._id,
        };
        suggestons.push(item);
    }

    // iterate authors
    var aut_suggestions = [];
    var j = 0;
    for (; j < result.suggest.authors[0].options.length; j++) {
        var names = result.suggest.authors[0].options[j]._source.metadata_author;
        var text = result.suggest.authors[0].options[j].text;

        var output = text;
        var t = 0;
        for (; t < names.length; t++) {
            if (names[t].alias.indexOf(text) > -1) {
                output = names[t].name;
                labeltype = names[t].labeltype == null ? "" : names[t].labeltype;
            }
        }
        var item = { text: output, labeltype: labeltype, type: "AUTHOR" };
        aut_suggestions.push(item);
    }

    var pub_suggestions = [];
    var j = 0;
    for (; j < result.suggest.publishers[0].options.length; j++) {
        var names = result.suggest.publishers[0].options[j]._source.metadata_publisher;
        var text = result.suggest.publishers[0].options[j].text;
        var name = text;
        var labeltype;
        var t = 0;

        for (; t < names.length; t++) {
            if (names[t].suggest.indexOf(text) > -1) {
                name = names[t].name;
                labeltype = names[t].labeltype == null ? "" : names[t].labeltype;
            }
        }
        var item = { text: name, labeltype: labeltype, type: "PUBLISHER" };
        pub_suggestions.push(item);
    }
    aut_suggestions = uniq(aut_suggestions, "text");
    pub_suggestions = uniq(pub_suggestions, "text");

    suggestons.push.apply(suggestons, aut_suggestions);
    suggestons.push.apply(suggestons, pub_suggestions);

    // sort
    suggestons.sort(function (a, b) {
        return a.output - b.output;
    });

    return suggestons;
};

var getAuthorSuggestions = function (name) {
    return elasticClient.search({
        index: config.index_entries,
        body: {
            suggest: {
                text: name,
                authors: {
                    completion: {
                        field: "authorsuggest",
                        skip_duplicates: true,
                        size: 10,
                    },
                },
            },
        },
    });
};

var prepareAuthorSuggestions = function (result) {
    var suggestons = [];

    function uniq(a, param) {
        return a.filter(function (item, pos, array) {
            return (
                array
                    .map(function (mapItem) {
                        return mapItem[param];
                    })
                    .indexOf(item[param]) === pos
            );
        });
    }
    // iterate authors
    var suggestons = [];
    var j = 0;
    for (; j < result.suggest.authors[0].options.length; j++) {
        var names = result.suggest.authors[0].options[j]._source.metadata_author;
        var text = result.suggest.authors[0].options[j].text;
        var labeltype;

        var output = text;
        var t = 0;

        for (; t < names.length; t++) {
            if (names[t].alias.indexOf(text) > -1) {
                output = names[t].name;
                labeltype = names[t].labeltype == null ? "" : names[t].labeltype;
            }
        }
        var item = { text: output, labeltype: labeltype };
        suggestons.push(item);
    }
    // sort
    suggestons.sort(function (a, b) {
        return a.output - b.output;
    });
    suggestons = uniq(suggestons, "text");

    return suggestons;
};

var getPublisherSuggestions = function (name) {
    return elasticClient.search({
        index: config.index_entries,
        body: {
            suggest: {
                text: name,
                publishers: {
                    completion: {
                        field: "publishersuggest",
                        skip_duplicates: false,
                        size: 10,
                    },
                },
            },
        },
    });
};

var preparePublisherSuggestions = function (result) {
    var suggestons = [];
    function uniq(a, param) {
        return a.filter(function (item, pos, array) {
            return (
                array
                    .map(function (mapItem) {
                        return mapItem[param];
                    })
                    .indexOf(item[param]) === pos
            );
        });
    }
    // iterate publishers
    var suggestons = [];
    var j = 0;
    for (; j < result.suggest.publishers[0].options.length; j++) {
        var names = result.suggest.publishers[0].options[j]._source.metadata_publisher;
        var text = result.suggest.publishers[0].options[j].text;
        var name = text;
        var labeltype;
        var t = 0;

        for (; t < names.length; t++) {
            if (names[t].suggest.indexOf(text) > -1) {
                name = names[t].name;
                labeltype = names[t].labeltype == null ? "" : names[t].labeltype;
            }
        }
        var item = { text: name, labeltype: labeltype };
        suggestons.push(item);
    }
    // sort
    suggestons.sort(function (a, b) {
        return a.output - b.output;
    });
    suggestons = uniq(suggestons, "text");

    return suggestons;
};

/* GET title suggestions for completion (all) */
/**
 * Return title suggestions for completion (all)
 * 
 * OK:
 * curl "http://localhost:3000/v5/suggest/Head" | jq .
 * 
 * NOT OK: (invalid ID)
 * curl -s -D - "http://localhost:3000/v5/entries/002259x"
 * 
 * NOT FOUND:
 * curl -s -D - "http://localhost:3000/v5/entries/1231231"
 * 
 * RETURNS:
 * 200: OK
 * 404: Not Found (ID not found)
 * 422: Invalid Input (ID is invalid)
 * 500: Server error
 */
router.get("/suggest/:query", function (req, res, next) {
    debug("==> /suggest/:query");
    getSuggestions(req.params.query).then(function (result) {
        debug(`########### RESPONSE from getSuggestions(${req.params.query})`);
        debug(result);
        debug(`#############################################################`);
        res.send(prepareSuggestions(result));
    });
});

/* GET suggestions for AUTHOR names */
router.get("/suggest/author/:name", function (req, res, next) {
    debug("==> /suggest/authors/:name");
    getAuthorSuggestions(req.params.name).then(function (result) {
        debug(`########### RESPONSE from getAuthorSuggestions(${req.params.name})`);
        debug(result);
        debug(`#############################################################`);
        res.send(prepareAuthorSuggestions(result));
    });
});

/* GET suggestions for PUBLISHER names */
router.get("/suggest/publisher/:name", function (req, res, next) {
    debug("==> /publisher/:name");
    getPublisherSuggestions(req.params.name).then(function (result) {
        debug(`########### RESPONSE from getPublisherSuggestions(${req.params.name})`);
        debug(result);
        debug(`#############################################################`);
        res.send(preparePublisherSuggestions(result));
    });
});

router.use(function (req, res, next) {
    debug(`SUGGEST: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);

    helpers.defaultRouter(moduleId, debug, req, res, next);
});

module.exports = router;