const moduleId = "search";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);

const express = require("express");
const router = express.Router();

const tools = require("../common/utils");
const queryHelper = require("../common/queryTerms");
const search = require("../common/helpersSearch");
const helpers = require("../common/helpersRequest");

const { elasticClient, config, isDevelopment } = require("../common/elastic");

var getSortObject = function (sort_mode) {
  var sort_object;
  debug(`getSortObject(${sort_mode})`);

  if (sort_mode === "name_asc") {
    sort_object = [
      {
        "name.keyword": {
          order: "asc",
        },
      },
    ];
  } else if (sort_mode === "name_desc") {
    sort_object = [
      {
        "name.keyword": {
          order: "desc",
        },
      },
    ];
  }

  debug(sort_object);
  return sort_object;
};

var getAllMagazines = function (page_size, offset, sort) {
  debug("getAllMagazines()");

  var sort_mode = sort == undefined ? "date_desc" : sort;
  var sort_object = getSortObject(sort_mode);

  return elasticClient.search({
    index: config.index_magazines,
    _source_includes: ["name", "publisher", "language", "country", "type"],
    body: {
      size: page_size,
      from: offset * page_size,
      query: {
        bool: {
          must: [
            {
              match_all: {},
            },
          ],
        },
      },
      sort: { "name.keyword": { order: "asc" } },
    },
  });
};

var getMagazineByName = function (name) {
  debug("getMagazineByName(" + name + ")");
  return elasticClient.search({
    index: config.index_magazines,
    body: {
      query: {
        bool: {
          must: [
            {
              match: {
                name: name,
              },
            },
          ],
        },
      },
    },
  });
};

var getIssuesByMagazineName = function (name) {
  debug("getIssuesByMagazineName()");

  return elasticClient.search({
    index: config.index_magazines,
    body: {
      _source: {
        includes: ["*"],
        excludes: ["issues.files.*", "issues.references.*"],
      },
      size: 1,
      from: 0,
      query: {
        bool: {
          must: [
            {
              match: {
                "name.keyword": name,
              },
            },
          ],
        },
      },
    },
  });
};

var getIssue = function (name, issueid) {
  debug(`getIssue(${name}, ${issueid})`);

  return elasticClient.search({
    index: config.index_magazines,
    body: {
      _source: {
        includes: ["*"],
      },
      size: 1,
      from: 0,
      query: {
        bool: {
          must: [
            {
              match: {
                name: name,
              },
            },
            {
              match: {
                "issues.id": issueid,
              },
            },
          ],
        },
      },
    },
  });
};

/************************************************
 *
 * common to use for all requests
 *
 ************************************************/
router.use(function (req, res, next) {
  debug(`got request - start processing, path: ${req.path}`);
  debug(`user-agent: ${req.headers["user-agent"]}`);
  // res.header("Access-Control-Allow-Origin", "*");
  // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  // do logging
  next(); // make sure we go to the next routes and don't stop here
});

/************************************************
 *
 * requests served by this endpoint
 *
 ************************************************/

/**
    Return all magazines
*/
router.get("/magazines/", function (req, res, next) {
  debug("==> /magazines/");

  if (!req.query.size) req.query.size = 500;
  if (!req.query.offset) req.query.offset = 0;
  getAllMagazines(req.query.size, req.query.offset, req.query.sort).then(function (result) {
    debug(
      `########### RESPONSE from getAllMagazines(size: ${req.query.size}, offset: ${req.query.offset}, mode: ${req.query.sort})`
    );
    debug(result);
    debug(`#############################################################`);
    res.header("X-Total-Count", result.hits.total.value);
    res.send(result);
  });
});

/**
    Return magazine with :name
*/
router.get("/magazines/:name", function (req, res, next) {
  debug(`==> /magazines/:name`);

  getMagazineByName(req.params.name).then(function (result) {
    debug(`########### RESPONSE from getMagazineByName(name: ${req.params.name})`);
    debug(result);
    debug(`#############################################################`);
    if (result.hits.hits.length == 0) {
      debug("NOT FOUND: ", req.params.name);
      res.status(404).end();
    } else {
      var _source = result.hits.hits[0];
      res.send(_source);
    }
  });
});

/**
    Return issues for magazine with :name
*/
router.get("/magazines/:name/issues", function (req, res, next) {
  debug("==> /magazines/:name/issues");

  getIssuesByMagazineName(req.params.name).then(function (result) {
    debug(`########### RESPONSE from getIssuesByMagazineName(name: ${req.params.name})`);
    debug(result);
    debug(`#############################################################`);
    if (result.hits.hits.length == 0) {
      debug("NOT FOUND: ", req.params.name);
      res.status(404).end();
    } else {
      var _source = result.hits.hits[0]._source;
      if (_source.issues === undefined) {
        _source.issues = [];
      }
      debug("X-Total-Count", _source.issues.length);
      res.header("X-Total-Count", _source.issues.length);
      res.send(_source);
    }
  });
});

/**
    Return issue for magazine with :name and issueid
*/
router.get("/magazines/:name/issues/:issueid", function (req, res, next) {
  debug("==> /magazines/:name/issues/:issueid");

  getIssue(req.params.name, req.params.issueid).then(function (result) {
    debug(`########### RESPONSE from getIssue(name: ${req.params.name}, issue: ${req.params.issueid})`);
    debug(result);
    debug(`#############################################################`);
    if (result.hits.hits.length == 0) {
      debug("NOT FOUND: ", req.params.name, req.params.issueid);
      res.status(404).end();
    } else {
      var _source = result.hits.hits[0]._source;

      function getIssueById(id) {
        return _source.issues.filter(function (data) {
          return data.id == id;
        });
      }
      var found = getIssueById(req.params.issueid)[0];
      res.send({
        magazine_id: result.hits.hits[0]._id,
        issue_id: req.params.issueid,
        name: _source.name,
        publisher: _source.publisher,
        type: _source.type,
        country: _source.country,
        language: _source.language,
        link_mask: _source.link_mask,
        archive_mask: _source.archive_mask,
        issue: found,
      });
    }
  });
});

module.exports = router;
