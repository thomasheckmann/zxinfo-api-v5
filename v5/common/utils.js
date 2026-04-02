import debugLib from "debug";
import * as flatPkg from "flat";

const flatten = flatPkg.flatten ?? flatPkg.default?.flatten;

const debug = debugLib("zxinfo-api-v5:utils");
const debugTrace = debugLib("zxinfo-api-v5:utils:trace");

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

const DEFAULT_MODE = "compact";
const DEFAULT_SIZE = 25;
const DEFAULT_OFFSET = 0;
const DEFAULT_SORT = "rel_desc";

/**
 * sets default values, if they does not exists
 *
 * - mode
 * - size
 * - offset
 * - sort
 *
 */
const setDefaultValuesModeSizeOffsetSort = (q) => {
  logEvent(debug, { level: "info", event: "utils.defaults.apply", module: "utils" });
  if (!q.mode) {
    logEvent(debugTrace, { level: "trace", event: "utils.defaults.set", module: "utils", field: "mode", value: DEFAULT_MODE });
    q.mode = DEFAULT_MODE;
  }
  if (!q.size) {
    logEvent(debugTrace, { level: "trace", event: "utils.defaults.set", module: "utils", field: "size", value: DEFAULT_SIZE });
    q.size = DEFAULT_SIZE;
  }
  if (!q.offset) {
    logEvent(debugTrace, { level: "trace", event: "utils.defaults.set", module: "utils", field: "offset", value: DEFAULT_OFFSET });
    q.offset = DEFAULT_OFFSET;
  }
  if (!q.sort) {
    logEvent(debugTrace, { level: "trace", event: "utils.defaults.set", module: "utils", field: "sort", value: DEFAULT_SORT });
    q.sort = DEFAULT_SORT;
  }
  return q;
};

const setDefaultValueMode = (q) => {
  logEvent(debug, { level: "info", event: "utils.defaults.mode", module: "utils" });
  if (!q.mode) {
    logEvent(debugTrace, { level: "trace", event: "utils.defaults.set", module: "utils", field: "mode", value: DEFAULT_MODE });
    q.mode = DEFAULT_MODE;
  }
  return q;
};

/*	
	Builds ES object for sorting, based on sort_mode.
	sort_mode:
		* title_asc or title_desc (sort by title)
		* date_asc or date_desc   (sort by release date)
		* rel_asc or rel_desc     (sort by relevance score)
*/
const getSortObject = (sort_mode) => {
  let sort_object;

  if (sort_mode === "title_asc") {
    sort_object = [
      {
        "title.keyword": {
          order: "asc",
        },
      },
    ];
  } else if (sort_mode === "title_desc") {
    sort_object = [
      {
        "title.keyword": {
          order: "desc",
        },
      },
    ];
  } else if (sort_mode === "date_asc") {
    sort_object = [
      {
        originalYearOfRelease: {
          order: "asc",
        },
      },
      {
        originalMonthOfRelease: {
          order: "asc",
        },
      },
      {
        originalDayOfRelease: {
          order: "asc",
        },
      },
    ];
  } else if (sort_mode === "date_desc") {
    sort_object = [
      {
        originalYearOfRelease: {
          order: "desc",
        },
      },
      {
        originalMonthOfRelease: {
          order: "desc",
        },
      },
      {
        originalDayOfRelease: {
          order: "desc",
        },
      },
    ];
  } else if (sort_mode === "rel_asc") {
    sort_object = [
      {
        _score: {
          order: "asc",
        },
      },
    ];
  } else if (sort_mode === "rel_desc") {
    sort_object = [
      {
        _score: {
          order: "desc",
        },
      },
      {
        "title.keyword": {
          order: "asc",
        },
      },
    ];
  }
  return sort_object;
};

/**
 * returns fields according to output mode for single item
 * @param {*} outputmode
 */
const es_source_item = (outputmode) => {
  logEvent(debugTrace, { level: "trace", event: "utils.es_source_item", module: "utils", mode: outputmode });
  if (outputmode === "full") {
    /* full output */
    return ["*"];
  } else if (outputmode === "compact") {
    /* compact output */
    const source_includes = [
      "title",
      "xrated",
      "contentType",
      "zxinfoVersion",
      "originalYearOfRelease",
      "originalMonthOfRelease",
      "originalDayOfRelease",
      "machineType",
      "numberOfPlayers",
      "multiplayerMode",
      "multiplayerType",
      "genre",
      "genreType",
      "genreSubType",
      "isbn",
      "language",
      "originalPrice",
      "availability",
      "remarks",
      "knownErrors",
      "hardwareBlurb",
      "score",
      "publishers",
      "releases",
      "authors",
      "authoredWith",
      "authoring",
      "controls",
      "series",
      "otherSystems",
      "inCompilations",
      "compilationContents",
      "inBook",
      "bookContents",
      "modificationOf",
      "modifiedBy",
      "inspiredBy",
      "otherPlatform",
      "additionalDownloads",
      "screens",
    ];
    return source_includes;
  } else if (outputmode === "tiny") {
    return [
      "title",
      "xrated",
      "zxinfoVersion",
      "contentType",
      "originalYearOfRelease",
      "machineType",
      "genre",
      "genreType",
      "genreSubType",
      "isbn",
      "score",
      "publishers.publisherSeq",
      "publishers.name",
      "publishers.country",
      "additionalDownloads",
      "screens",
    ];
  }
};

/**
 * returns fields according to output mode for search results
 * @param {
 * } outputmode
 */
const es_source_list = (outputmode, includeAgg = false) => {
  logEvent(debugTrace, {
    level: "trace",
    event: "utils.es_source_list",
    module: "utils",
    mode: outputmode,
    includeAgg,
  });
  if (outputmode === "full") {
    /* full output */
    return ["*"];
  } else if (outputmode === "compact") {
    /* compact output */
    const source_includes = [
      "title",
      "xrated",
      "contentType",
      "zxinfoVersion",
      "originalYearOfRelease",
      "originalMonthOfRelease",
      "originalDayOfRelease",
      "machineType",
      "score",
      "isbn",
      "genre",
      "genreType",
      "genreSubType",
      "availability",
      "authors",
      "publishers",
      "releases.publishers",
      "releases.files",
      "additionalDownloads",
      "screens",
    ];
    return source_includes;
  } else if (outputmode === "tiny") {
    return [
      "title",
      "xrated",
      "contentType",
      "zxinfoVersion",
      "originalYearOfRelease",
      "machineType",
      "score",
      "isbn",
      "genre",
      "genreType",
      "genreSubType",
      "availability",
      "publishers.publisherSeq",
      "publishers.name",
      "publishers.country",
      "additionalDownloads",
      "screens",
    ];
  } else if (outputmode === "simple") {
    return ["title"];
  }
};

/**
 *
 * simple output format: {id. title}
 *
 */
const renderSimpleOutput = (r) => {
  const hits = r?.hits?.hits ?? [];
  logEvent(debugTrace, {
    level: "trace",
    event: "utils.render.simple",
    module: "utils",
    hits: hits.length,
  });
  return hits.map((item) => ({ id: item._id, title: item._source.title }));
};

/**
 *
 * flat output format: key=value
 *
 */
const renderFlatOutputEntries = (r) => {
  const data = flatten(r);
  logEvent(debugTrace, {
    level: "trace",
    event: "utils.render.flat.entries.start",
    module: "utils",
    keys: Object.keys(data).length,
  });
  let result = "";
  let emitted = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("hits.") || key.startsWith("aggregations.")) {
      result += key.replace("hits.", "").replace("_source.", "") + "=" + value + "\n";
      emitted += 1;
    }
  }
  logEvent(debugTrace, {
    level: "trace",
    event: "utils.render.flat.entries.done",
    module: "utils",
    emitted,
  });
  return result;
};

const renderFlatOutputEntry = (r) => {
  const data = flatten(r);
  logEvent(debugTrace, {
    level: "trace",
    event: "utils.render.flat.entry.start",
    module: "utils",
    keys: Object.keys(data).length,
  });
  let result = "";
  let emitted = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_source.")) {
      result += key.replace("_source.", "") + "=" + value + "\n";
      emitted += 1;
    }
  }
  logEvent(debugTrace, {
    level: "trace",
    event: "utils.render.flat.entry.done",
    module: "utils",
    emitted,
  });
  return result;
};

/** TODO: one section, not 3 - simplify */
const renderMagazineLinks = (r) => {
  const replaceMask = (input, pattern, value) => {
    let result = input;
    const found = input.match(pattern);
    if (found !== null) {
      const template = found[0];
      const padding = found[1];
      let zero = ("0".repeat(padding) + value).slice(-padding);
      if (padding === "1") {
        // N = 1, plain value
        zero = value;
      }
      const re = new RegExp(template, "g");
      result = input.replace(re, zero);
    }
    return result;
  };

  const applyLinkMask = (items) => {
    for (const item of items ?? []) {
      let link_mask = item.link_mask;
      if (link_mask != null) {
        link_mask = replaceMask(link_mask, /{i(\d)+}/i, item.issueno);
        link_mask = replaceMask(link_mask, /{v(\d)+}/i, item.issuevolume);
        link_mask = replaceMask(link_mask, /{y(\d)+}/i, item.issueyear);
        link_mask = replaceMask(link_mask, /{m(\d)+}/i, item.issuemonth);
        link_mask = replaceMask(link_mask, /{d(\d)+}/i, item.issueday);
        link_mask = replaceMask(link_mask, /{p(\d)+}/i, item.pageno);
        item.path = link_mask;
        delete item.link_mask;
      }
    }
  };

  applyLinkMask(r._source.magazinereview);
  applyLinkMask(r._source.adverts);
  applyLinkMask(r._source.magrefs);

  return r;
};

export {
  es_source_item,
  es_source_list,
  renderSimpleOutput,
  renderFlatOutputEntries,
  renderFlatOutputEntry,
  getSortObject,
  renderMagazineLinks,
  setDefaultValuesModeSizeOffsetSort,
  setDefaultValueMode,
};
