import debugLib from "debug";

const moduleId = "queryTerms";

const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const debugTrace = debugLib(`zxinfo-api-v5:${moduleId}:trace`);

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

/**
 * Builds the default weighted search query used by GET /search/:searchterm.
 * Matches across title suggestions, exact titles, OCR text, releases, publishers, authors,
 * and remarks to surface broad, relevance-ranked results.
 *
 * @param {string} searchTerm - Search text to match.
 * @param {Object} filterObject - Filter query object assembled from request filters.
 * @returns {Object} Elasticsearch query clause.
 */
function queryTermDefault(searchTerm, filterObject) {
    return {
        bool: {
            should: [
                {
                    match: {
                        titlesuggest: { query: searchTerm, boost: 10 },
                    },
                },
                {
                    term: {
                        "title.keyword": {
                            value: searchTerm,
                            case_insensitive: true,
                            boost: 8
                        }
                    }
                },
                {
                    match: {
                        title: {
                            query: searchTerm,
                            boost: 6
                        }
                    },
                },
                {
                    match_phrase: {
                        title: {
                            query: searchTerm,
                            boost: 4
                        }
                    }
                },
                {
                    wildcard: { title: "*" + searchTerm + "*" }
                },
                {
                    match_phrase: {
                        "textscan.text": {
                            query: searchTerm, boost: 6
                        },
                    }
                },
                {
                    nested: {
                        path: "releases",
                        query: {
                            bool: {
                                must: [
                                    {
                                        match_phrase_prefix: {
                                            "releases.releaseTitles": searchTerm,
                                        },
                                    },
                                ],
                            },
                        },
                        boost: 1.5,
                    },
                },
                /* releases publisers */
                {
                    nested: {
                        path: "releases.publishers",
                        query: {
                            bool: {
                                must: [
                                    {
                                        match: {
                                            "releases.publishers.name": searchTerm,
                                        },
                                    },
                                ],
                            },
                        },
                        boost: 2,
                    },
                },
                /* */
                /* publisher names */
                {
                    nested: {
                        path: "publishers",
                        query: {
                            bool: {
                                must: [
                                    {
                                        match_phrase: {
                                            "publishers.name": {
                                                query: searchTerm
                                            }
                                        }
                                    }
                                ],
                            },
                        },
                        boost: 8,
                    },
                },
                /* authors name and group */
                {
                    nested: {
                        path: "authors",
                        query: {
                            bool: {
                                should: [
                                    {
                                        match_phrase: {
                                            "authors.name": {
                                                query: searchTerm
                                            }
                                        }
                                    },
                                    {
                                        match_phrase: {
                                            "authors.groupName": {
                                                query: searchTerm
                                            }
                                        }
                                    },
                                ], minimum_should_match: 1,

                            },
                        },
                        boost: 2.5,
                    },
                },
                /* */
                /* comments */
                {
                    bool: {
                        must: [
                            {
                                match: {
                                    remarks: searchTerm,
                                },
                            },
                        ],
                        boost: 0,
                    },
                },

                /* */
            ],
        },
    };
}

/**
 * Builds a query limited to OCR and scanned screen text.
 *
 * @param {string} searchTerm - Search text to match.
 * @param {Object} filterObject - Filter query object assembled from request filters.
 * @returns {Object} Elasticsearch query clause.
 */
function queryTermScreenOnly(searchTerm, filterObject) {
    return {
        bool: {
            must: [{
                match_phrase: {
                    "textscan.text": searchTerm
                },
            }],
            filter: filterObject
        }
    }
}

/**
 * Builds a query limited to title-oriented fields.
 *
 * @param {string} searchTerm - Title text to match.
 * @param {Object} filterObject - Filter query object assembled from request filters.
 * @returns {Object} Elasticsearch query clause.
 */
function queryTermTitlesOnly(searchTerm, filterObject) {
    return {
        bool: {
            should: [
                {
                    term: {
                        "title.keyword": {
                            value: searchTerm,
                            case_insensitive: true,
                            boost: 8
                        }
                    }
                },
                {
                    match: {
                        title: {
                            query: searchTerm,
                            boost: 6
                        }
                    },
                },
                {
                    match_phrase: {
                        title: {
                            query: searchTerm,
                            boost: 4
                        }
                    }
                },
                {
                    match: {
                        titlesuggest: { query: searchTerm, boost: 10 },
                    },
                },
                {
                    wildcard: { title: "*" + searchTerm + "*" }
                },
            ],
            minimum_should_match: 1,
            filter: filterObject
        },
    };
}

/**
 * Builds the negative side of the boosting query used to demote derivative,
 * compilation, and covertape results without excluding them.
 *
 * @returns {Object} Elasticsearch query clause.
 */
function queryTermNegativeBoost() {
    return {
        bool: {
            should: [
                {
                    exists: {
                        field: "modificationOf.title",
                    },
                },
                {
                    exists: {
                        field: "inspiredBy.title",
                    },
                },
                {
                    match: {
                        genreType: "Compilation", // boost negative if part of compilation
                    },
                },
                {
                    match: {
                        genreType: "Covertape", // boost negative if part of covertape
                    },
                },
            ]
        }
    }
}

/**
 * Creates a reusable filter clause for one request parameter.
 * Accepts either a single value or an array and converts it into a bool/should filter.
 *
 * @param {string} filterName - Indexed field name to filter.
 * @param {string|string[]|undefined} filterValues - Incoming filter values.
 * @returns {Object} Elasticsearch bool filter or an empty object.
 */
function createFilterItem(filterName, filterValues) {
    logEvent(debugTrace, {
        level: "trace",
        event: "query.filter.item.start",
        module: moduleId,
        filterName,
        valuesCount: Array.isArray(filterValues) ? filterValues.length : (filterValues ? 1 : 0),
    });
    var item_should = {};

    if (filterValues !== undefined && filterValues.length > 0) {
        if (!Array.isArray(filterValues)) {
            filterValues = [filterValues];
        }
        var i = 0;
        var should = [];
        for (; i < filterValues.length; i++) {
            var item = {
                match: {
                    [filterName]: filterValues[i],
                },
            };
            should.push(item);
        }

        item_should = { bool: { should: should, minimum_should_match: 1 } };
    }
    logEvent(debugTrace, {
        level: "trace",
        event: "query.filter.item.done",
        module: moduleId,
        filterName,
        hasFilter: Object.keys(item_should).length > 0,
    });
    return item_should;
};

/**
 * Filter by playable type:
 * TOSEC - TZX & TAP
 * SC - tzx.zip & tzp.zip
 *
 * @param {string} filterName - Logical filter name from the request.
 * @param {string|string[]|undefined} filterValues - Incoming TOSEC/playable type filters.
 * @returns {Object} Elasticsearch bool filter or an empty object.
 */
const createFilterItemPlayableType = function (filterName, filterValues) {
    logEvent(debugTrace, {
        level: "trace",
        event: "query.filter.playable.start",
        module: moduleId,
        filterName,
        valuesCount: Array.isArray(filterValues) ? filterValues.length : (filterValues ? 1 : 0),
    });
    let item_should = {};

    if (filterValues !== undefined && filterValues.length > 0) {
        if (!Array.isArray(filterValues)) {
            filterValues = [filterValues];
        }
        let i = 0;
        const should = [];
        for (; i < filterValues.length; i++) {
            const item = {
                regexp: {
                    "tosec.path": {
                        value: `.*(${filterValues[i].toLowerCase()}|${filterValues[i].toUpperCase()})`,
                        flags: "ALL",
                    },
                },
            };
            should.push(item);
        }

        i = 0;
        for (; i < filterValues.length; i++) {
            const item = {
                nested: {
                    path: "releases.files",
                    query: {
                        bool: {
                            must: [
                                {
                                    regexp: {
                                        "releases.files.path": {
                                            value: `.*(${filterValues[i].toLowerCase()}|${filterValues[i].toUpperCase()})\.(zip|ZIP)`,
                                            flags: "ALL"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            };
            should.push(item);
        }

        item_should = { bool: { should: should, minimum_should_match: 1 } };
    }
    logEvent(debugTrace, {
        level: "trace",
        event: "query.filter.playable.done",
        module: moduleId,
        filterName,
        hasFilter: Object.keys(item_should).length > 0,
    });
    return item_should;
};

/**
 * Collects all supported request filters into named Elasticsearch filter fragments.
 * Group filters are translated from short request codes to the corresponding indexed field.
 *
 * @param {import("express").Request} req - Express request containing query parameters.
 * @returns {Object<string, Object>} Map of logical filter names to filter clauses.
 */
function createFilterObjects(req) {
    var filterObjects = {}; // (name of ..), filter

    var contenttype_should = createFilterItem("contentType", req.query.contenttype);
    filterObjects["contenttype"] = contenttype_should;

    var machinetype_should = createFilterItem("machineType", req.query.machinetype);
    filterObjects["machinetypes"] = machinetype_should;

    var genretype_should = createFilterItem("genreType", req.query.genretype);
    filterObjects["genretype"] = genretype_should;

    var genresubtype_should = createFilterItem("genreSubType", req.query.genresubtype);
    filterObjects["genresubtype"] = genresubtype_should;

    var controls_should = createFilterItem("controls.control", req.query.control);
    filterObjects["controls"] = controls_should;

    var multiplayermode_should = createFilterItem("multiplayerMode", req.query.multiplayermode);
    filterObjects["multiplayermode"] = multiplayermode_should;

    var multiplayertype_should = createFilterItem("multiplayerType", req.query.multiplayertype);
    filterObjects["multiplayertype"] = multiplayertype_should;

    var xrated_should = createFilterItem("xrated", req.query.xrated);
    filterObjects["xrated"] = xrated_should;

    var availability_should = createFilterItem("availability", req.query.availability);
    filterObjects["availability"] = availability_should;

    var language_should = createFilterItem("language", req.query.language);
    filterObjects["language"] = language_should;

    var year_should = createFilterItem("originalYearOfRelease", req.query.year);
    filterObjects["yearofrelease"] = year_should;

    var tosectype_should = createFilterItemPlayableType("tosectype", req.query.tosectype);
    filterObjects["tosectype"] = tosectype_should;

    var grouptype_id = "";

    if (req.query.group === "CC") {
        grouptype_id = "competition";
    } else if (req.query.group === "D") {
        grouptype_id = "demoParty";
    } else if (req.query.group === "F") {
        grouptype_id = "features";
    } else if (req.query.group === "G") {
        grouptype_id = "graphicalView";
    } else if (req.query.group === "L") {
        grouptype_id = "programmingLanguage";
    } else if (req.query.group === "M") {
        grouptype_id = "screenMovement";
    } else if (req.query.group === "P") {
        grouptype_id = "sport";
    } else if (req.query.group === "R") {
        grouptype_id = "copyright";
    } else if (req.query.group === "T") {
        grouptype_id = "themedGroup";
    } else if (req.query.group === "U") {
        grouptype_id = "unsortedGroup";
    } else if (req.query.group === "X") {
        grouptype_id = "crossPlatform";
    } else if (req.query.group === "Z") {
        grouptype_id = "featuresZX81";
    }

    /**
     * GROUPS
     */
    var groupandname_must = {};
    if (req.query.group !== undefined && req.query.groupname !== undefined) {
        var groupBools = [];
        groupBools.push({
            bool: {
                must: {
                    match: {
                        [grouptype_id + ".name"]: req.query.groupname,
                    },
                },
            },
        });
        groupandname_must = { bool: { must: groupBools } };
        filterObjects["groupandname"] = groupandname_must;
    }
    return filterObjects;
}

/**
 * Combines all non-empty request filter fragments into a single bool/must filter query.
 *
 * @param {import("express").Request} req - Express request containing query parameters.
 * @returns {Object} Elasticsearch filter query.
 */
function createFilterQuery(req) {
    var filters = [];
    const filterObjects = createFilterObjects(req);
    var filterNames = Object.keys(filterObjects);
    for (var i = 0; i < filterNames.length; i++) {
        var item = filterObjects[filterNames[i]];
        var itemsize = Object.keys(item).length;
        if (itemsize > 0) {
            filters.push(item);
        }
    }

    return {
        "bool": {
            "must": filters
        }
    }

}

/**
 * Builds the aggregation tree returned when includeagg is enabled.
 * Each aggregation applies the active search query and all active filters except its own,
 * allowing facet counts to remain useful while filtering.
 *
 * @param {import("express").Request} req - Express request containing query parameters.
 * @param {Object} query - The base positive search query.
 * @returns {Object} Elasticsearch aggregation definition.
 */
function createAggregationQuery(req, query) {
    // debug(`createAggregationQuery: ${JSON.stringify(query, null, 2)}`);
    /**
     * Helper for aggregation - each aggregation should include all filters, except its own
     */
    function removeFilter(filters, f) {
        var newFilter = [...filters];
        const index = newFilter.indexOf(f);
        if (index >= 0) {
            newFilter.splice(index, 1);
        }

        // remove empty objects
        const r = newFilter.filter((value) => Object.keys(value).length !== 0);

        return r;
    }

    function createAggObject(filterlist, filtername, fieldName) {
        var filter = removeFilter(filterlist, filterObjects[filtername]);
        var aggObject = {
            filter: {
                bool: {
                    must: filter,
                },
            },
            aggregations: {
            }
        };

        aggObject.aggregations[`filtered_${filtername}`] = {
            terms: {
                size: 100,
                field: fieldName,
                order: {
                    _key: "asc",
                },
            },
        }

        return aggObject;
    }

    const filterObjects = createFilterObjects(req);
    let aggfilter = [
        query
    ];

    var filterNames = Object.keys(filterObjects);
    for (var i = 0; i < filterNames.length; i++) {
        var item = filterObjects[filterNames[i]];
        var itemsize = Object.keys(item).length;
        if (itemsize > 0) {
            aggfilter.push(item);
        }
    }

    // debug(`Building aggregations: base=${JSON.stringify(query, null, 2)}`);
    // debug(`Building aggregations: aggfilter=${JSON.stringify(aggfilter, null, 2)}`);
    var aggObjects = {};
    // aggName, filtername, fieldname

    aggObjects["aggMachineTypes"] = createAggObject(aggfilter, "machinetypes", "machineType");
    aggObjects["aggGenreType"] = createAggObject(aggfilter, "genretype", "genreType");
    aggObjects["aggGenreSubType"] = createAggObject(aggfilter, "genresubtype", "genreSubType");
    aggObjects["aggControls"] = createAggObject(aggfilter, "controls", "controls.control");
    aggObjects["aggMultiplayerMode"] = createAggObject(aggfilter, "multiplayermode", "multiplayerMode");
    aggObjects["aggMultiplayerType"] = createAggObject(aggfilter, "multiplayertype", "multiplayerType");
    aggObjects["aggAvailability"] = createAggObject(aggfilter, "availability", "availability");
    aggObjects["aggLanguage"] = createAggObject(aggfilter, "language", "language");
    aggObjects["aggOriginalYearOfRelease"] = createAggObject(aggfilter, "yearofrelease", "originalYearOfRelease");

    return {
        all_entries: {
            global: {},
            aggregations: aggObjects
        }
    }

}

export {
    queryTermDefault,
    queryTermTitlesOnly,
    queryTermScreenOnly,
    queryTermNegativeBoost,
    createFilterQuery,
    createAggregationQuery,
};