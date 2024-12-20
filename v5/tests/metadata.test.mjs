import { test, describe } from 'node:test';
import assert from 'node:assert';

const API_ENDPOINT_URL = "http://localhost:3000/v5/";

describe("Testing `metadata` API endpoint", function () {
    test("running tests on API", async function (t) {
        await t.test("testing /metadata ", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/metadata", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            // console.log(`returned: ${body.length} entrie(s)`);
            assert.equal(body.machinetypes.values.length > 1, true);
        })
    })
})

