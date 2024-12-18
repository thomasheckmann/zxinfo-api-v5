import { test, describe } from 'node:test';
import assert from 'node:assert';

const API_ENDPOINT_URL = "http://localhost:3000/v5/";

describe("Testing `entries` API endpoint", function () {
    test("running tests on API", async function (t) {
        await t.test("testing /entries/0002259 - should return Head over Heels", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/002259", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            assert.deepStrictEqual(body._id, "0002259");
            assert.deepStrictEqual(body._source.title, "Head over Heels");
        })

        await t.test("testing /entries/0002259x - invalid number (422)", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/002259x", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 422);
        })

        await t.test("testing /entries/1231231 - not found (404)", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/1231231", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 404);
        })

        await t.test("testing /entries/byletter/a - should return at least 25", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/byletter/a", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            assert.equal(body.hits.hits.length === 25, true);
        })

        await t.test("testing /entries/byletter/aa - invalid input (422)", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/byletter/aa", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 422);
        })
    })
})

