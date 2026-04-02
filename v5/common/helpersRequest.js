import { setDefaultValuesModeSizeOffsetSort } from "../common/utils.js";

// constans for machinetype
const ZXSPECTRUM = [
    "ZX-Spectrum 128 +2",
    "ZX-Spectrum 128 +2A/+3",
    "ZX-Spectrum 128 +2B",
    "ZX-Spectrum 128 +3",
    "ZX-Spectrum 128K",
    "ZX-Spectrum 128K (load in USR0 mode)",
    "ZX-Spectrum 16K",
    "ZX-Spectrum 16K/48K",
    "ZX-Spectrum 48K",
    "ZX-Spectrum 48K/128K",
];
const ZX81 = ["ZX81 64K", "ZX81 32K", "ZX81 2K", "ZX81 1K", "ZX81 16K"];
const PENTAGON = ["Scorpion", "Pentagon 128"];

// constans for genretype
const GAMES = ["Adventure Game", "Arcade Game", "Casual Game", "Game", "Sport Game", "Strategy Game"];

const formatLogValue = (value) => {
    if (value === undefined || value === null) {
        return "n/a";
    }
    const text = String(value);
    return text.includes(" ") ? JSON.stringify(text) : text;
};

const logEvent = (debug, fields) => {
    const message = Object.entries(fields)
        .map(([key, value]) => `${key}=${formatLogValue(value)}`)
        .join(" ");
    debug(message);
};

function debugInputRequest(debug, req) {
    logEvent(debug, {
        level: "trace",
        event: "request.query.snapshot",
        mode: req.query.mode,
        size: req.query.size,
        offset: req.query.offset,
        sort: req.query.sort,
        contenttype: req.query.contenttype,
        machinetype: req.query.machinetype,
        xrated: req.query.xrated,
        genretype: req.query.genretype,
        genresubtype: req.query.genresubtype,
        control: req.query.control,
        multiplayermode: req.query.multiplayermode,
        multiplayertype: req.query.multiplayertype,
        availability: req.query.availability,
        language: req.query.language,
        year: req.query.year,
        group: req.query.group,
        groupname: req.query.groupname,
        tosectype: req.query.tosectype,
    });
}

function defaultRouter(moduleId, debug, req, res, next) {
    logEvent(debug, {
        level: "info",
        event: "request.defaults.start",
        module: moduleId,
        path: req.path,
        method: req.method,
    });
    // do logging
    debugInputRequest(debug, req);

    // set default values for mode, size & offset
    req.query = setDefaultValuesModeSizeOffsetSort(req.query);

    // expand machinetype
    logEvent(debug, {
        level: "trace",
        event: "request.expand.machinetype.start",
        module: moduleId,
        value: req.query.machinetype,
    });
    if (req.query.machinetype) {
        var mTypes = [];
        if (!Array.isArray(req.query.machinetype)) {
            req.query.machinetype = [req.query.machinetype];
        }

        for (var i = 0; i < req.query.machinetype.length; i++) {
            logEvent(debug, {
                level: "trace",
                event: "request.expand.machinetype.item",
                module: moduleId,
                index: i,
                value: req.query.machinetype[i],
            });
            switch (req.query.machinetype[i]) {
                case "ZXSPECTRUM":
                    logEvent(debug, {
                        level: "trace",
                        event: "request.expand.machinetype.alias",
                        module: moduleId,
                        alias: "ZXSPECTRUM",
                    });
                    mTypes = mTypes.concat(ZXSPECTRUM);
                    break;
                case "ZX81":
                    logEvent(debug, {
                        level: "trace",
                        event: "request.expand.machinetype.alias",
                        module: moduleId,
                        alias: "ZX81",
                    });
                    mTypes = mTypes.concat(ZX81);
                    break;
                case "PENTAGON":
                    logEvent(debug, {
                        level: "trace",
                        event: "request.expand.machinetype.alias",
                        module: moduleId,
                        alias: "PENTAGON",
                    });
                    mTypes = mTypes.concat(PENTAGON);
                    break;
                default:
                    mTypes.push(req.query.machinetype[i]);
                    break;
            }
        }
        req.query.machinetype = mTypes;
        logEvent(debug, {
            level: "trace",
            event: "request.expand.machinetype.done",
            module: moduleId,
            value: mTypes,
        });
    }

    // expand genretype
    logEvent(debug, {
        level: "trace",
        event: "request.expand.genretype.start",
        module: moduleId,
        value: req.query.genretype,
    });
    if (req.query.genretype) {
        var gTypes = [];
        if (!Array.isArray(req.query.genretype)) {
            req.query.genretype = [req.query.genretype];
        }

        for (var i = 0; i < req.query.genretype.length; i++) {
            logEvent(debug, {
                level: "trace",
                event: "request.expand.genretype.item",
                module: moduleId,
                index: i,
                value: req.query.genretype[i],
            });
            switch (req.query.genretype[i]) {
                case "GAMES":
                    logEvent(debug, {
                        level: "trace",
                        event: "request.expand.genretype.alias",
                        module: moduleId,
                        alias: "GAMES",
                    });
                    gTypes = gTypes.concat(GAMES);
                    break;
                default:
                    gTypes.push(req.query.genretype[i]);
                    break;
            }
        }
        req.query.genretype = gTypes;
        logEvent(debug, {
            level: "trace",
            event: "request.expand.genretype.done",
            module: moduleId,
            value: gTypes,
        });
    }

    logEvent(debug, {
        level: "info",
        event: "request.defaults.ready",
        module: moduleId,
        path: req.path,
    });
    debugInputRequest(debug, req);

    next(); // make sure we go to the next routes and don't stop here
}

export {
    debugInputRequest,
    defaultRouter,
}