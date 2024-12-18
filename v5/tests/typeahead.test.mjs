import { test, describe } from 'node:test';
import assert from 'node:assert';

const API_ENDPOINT_URL = "http://localhost:3000/v5/";

describe("Testing `typeahead` API endpoint", function () {
    test("running tests on API", async function (t) {
        await t.test("testing /typeahead (ALL/ZX81) - should return more than one entry", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/typeahead/ALL/zx81", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            // console.log(`returned: ${body.length} entrie(s)`);
            assert.equal(body.length >= 1, true);
        })
    })
})

