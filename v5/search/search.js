import debugLib from "debug";
import express from "express";

import { defaultRouter } from "../common/helpersRequest.js";
import { getSortObject } from "../common/utils.js";
import { createFilterQuery, queryTermTitlesOnly, queryTermNegativeBoost } from "../common/queryTerms.js";
import { ZXSearchEntries } from "./helpersSearch.js";

const moduleId = "search";
const debug = debugLib(`zxinfo-api-v5:${moduleId}`);
const router = express.Router();

const ZXSPECTRUM = [
    "ZX-Spectrum 128 +2", "ZX-Spectrum 128 +2A/+3", "ZX-Spectrum 128 +2B", "ZX-Spectrum 128 +3",
    "ZX-Spectrum 128K", "ZX-Spectrum 128K (load in USR0 mode)", "ZX-Spectrum 16K",
    "ZX-Spectrum 16K/48K", "ZX-Spectrum 48K", "ZX-Spectrum 48K/128K",
];

router.get("/search/titles/:searchterm", async (req, res) => {
    debug(`==> /search/titles [${req.params.searchterm}]`);

    const searchTerm = req.params.searchterm.trim();
    if (searchTerm.length === 0) {
        return res.status(422).json({ error: "Search term must not be empty" });
    }
    if (searchTerm.length > 200) {
        return res.status(422).json({ error: "Search term must not exceed 200 characters" });
    }

    req.query.contenttype = 'SOFTWARE';
    req.query.machinetype = ZXSPECTRUM;
    debug(`mType: ${ZXSPECTRUM}`);

    const sortObject = getSortObject(req.query.sort);
    const filterQuery = createFilterQuery(req);
    const query = queryTermTitlesOnly(searchTerm, filterQuery);
    const queryNegative = queryTermNegativeBoost();

    const q = {
        boosting: {
            positive: query,
            negative: queryNegative,
            negative_boost: 0.5,
        },
    };

    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 15));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    await ZXSearchEntries(q, pageSize, offset, sortObject, res);
});

router.use((req, res, next) => {
    debug(`SEARCH: ${req.path}`);
    debug(`user-agent: ${req.headers["user-agent"]}`);
    defaultRouter(moduleId, debug, req, res, next);
});

export default router;
