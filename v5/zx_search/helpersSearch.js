/**
 * search - for simplified output
 */
"use strict";

const moduleId = "helperSearch";
const debug = require("debug")(`zxinfo-api-v5:${moduleId}`);
const tools = require("../common/utils");

const { elasticClient, config, isDevelopment } = require("../common/elastic");
const { flatten } = require("flat");

var source_includes = [
  "title",
  "xrated",
  //"contentType",
  //"zxinfoVersion",
  "originalYearOfRelease",
  // "originalMonthOfRelease",
  // "originalDayOfRelease",
  "machineType",
  // "score",
  // "isbn",
  "genre",
  //"availability",
  "authors.name",
  "publishers.name",
  // "releases.publishers",
  //"releases.files.path",
  //"releases.files.size",
  //"releases.files.format",
  //"additionalDownloads",
  // "screens",
];

var ZXRenderFlatOutputEntries = function (r) {
  const _MAX_LENGTH = 32;

  const ellipsis = (x) => {
    var s = x.substring(0, _MAX_LENGTH);
    if(s.length === _MAX_LENGTH) {
      s = s.substring(0, _MAX_LENGTH - 3) + "...";
    }
    return  s;
  }
  debug(`renderFlatOutputEntries() :`);
  debug(JSON.stringify(r, null, 2));

  var result = "r=" + r.hits.total.value + "\n";
  for (var i = 0; r.hits.hits && i < r.hits.hits.length; i++) {
    const item = r.hits.hits[i];
    result += "t=" + ellipsis(item._source.title) + "\n";

    // publishers, 'Gem Machine' for multiple publishers
    let p = "";
    for (var pidx = 0; pidx < item._source.publishers.length; pidx++) {
      p += item._source.publishers[pidx].name + ",";
    }
    p = p.substring(0, p.length - 1);
    result += "p=" + ellipsis(p) + "\n";

    // authors, 'Gem Machine' for multiple publishers
    let a = "";
    for (var aidx = 0; item._source.authors && aidx < item._source.authors.length; aidx++) {
      a += item._source.authors[aidx].name + ",";
    }
    a = a.substring(0, a.length - 1);
    result += "a=" + ellipsis(a) + "\n";

    result += "y=" + (item._source.originalYearOfRelease ? item._source.originalYearOfRelease + "\n" : "\n");
    result += "m=" + (item._source.machineType ? item._source.machineType + "\n" : "\n");
    result += "g=" + (item._source.genre ? item._source.genre + "\n" : "\n");

    // signal end of record;
    result +="-\n";
  }
  result += result.length;
  return result;

  // const data = flatten(r);
  // debug(`renderFlatOutputEntries()`);
  // debug(data);
  // var result = "";
  // for (let [key, value] of Object.entries(data)) {
  //   if (key.startsWith("hits.total.value")) {
  //     result += "r=" + value + "\n";
  //   } else if (key.endsWith("_score")||key.endsWith("_index")||key.endsWith(".sort.0")||key.endsWith(".sort.1")) {
  //     // ignore
  //   } else if (key.endsWith("_id")) {
  //     result += "i=" + value + "\n";
  //   } else if (key.startsWith("hits.hits.")) {
  //     result += key.replace("hits.hits.", "").replace("_source.", "") + "=" + value + "\n";
  //     debug(`${key}: ${value}`);
  //   }
  // }
  // result += result.length;
  return result;
};

/**
 *
 * @param {*} q - es query object
 * @param {*} page_size
 * @param {*} offset
 * @param {*} sortObject
 * @param {*} res
 * @returns
 */
function ZXSearchEntries(q, page_size, offset, sortObject, res) {
  debug(`searchEntries()`);
  debug(`\tsize: ${page_size}`);
  debug(`\toffset: ${offset}`);
  debug(`\tsort object: ${sortObject}`);
  // debug(`\outputmode: ${outputmode}`);
  // debug(`\output: ${output}`);

  const fromOffset = page_size * offset;
  return elasticClient
    .search({
      _source_includes: source_includes,
      _source_excludes: "titlesuggest, metadata_author,authorsuggest",
      index: config.index_entries,
      body: {
        track_scores: true,
        size: page_size,
        from: fromOffset,
        query: q,
        sort: sortObject,
      },
    })
    .then(function (result) {
      debug(`########### RESPONSE from elasticsearch`);
      debug(result);
      debug(`#############################################################`);

      res.header("X-Total-Count", result.hits.total.value);
      res.send(ZXRenderFlatOutputEntries(result));
    });
}

module.exports = {
  ZXSearchEntries: ZXSearchEntries,
};
