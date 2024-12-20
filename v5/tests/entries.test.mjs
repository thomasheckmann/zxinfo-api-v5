import { test, describe } from 'node:test';
import assert from 'node:assert';

const API_ENDPOINT_URL = "http://localhost:3000/v5/";

describe("Testing `entries` API endpoint", function () {
    test("running tests on API", async function (t) {
        /** /entries/ */
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

        /** /entries/byletter */
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

        /** /entries/morelikethis/ */
        await t.test("testing /entries/morelikethis/0002259 - should return at least 25", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/morelikethis/0002259", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            assert.equal(body.hits.hits.length === 25, true);
        })

        await t.test("testing /entries/morelikethis/0002259x - invalid number (422)", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/morelikethis/0002259x", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 422);
        })

        await t.test("testing /entries/morelikethis/1231231 - not found, 0", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/morelikethis/1231231", {
                method: 'GET',
            });
            const body = await request.json();
            assert.equal(body.hits.total.value === 0, true);
        })

        /** /entries/byauthor */
        await t.test("testing /entries/byauthor/ritman - should return at least 10", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/byauthor/ritman", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            assert.equal(body.hits.hits.length > 9, true);
        })

        await t.test("testing /entries/byauthor/abcdefghij - not found, 0", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/byauthor/abcdefghij", {
                method: 'GET',
            });
            const body = await request.json();
            assert.equal(body.hits.total.value === 0, true);
        })

        /** /entries/bypublisher */
        await t.test("testing /entries/bypublisher/ocean - should return at least 25", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/bypublisher/ocean", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            assert.equal(body.hits.hits.length === 25, true);
        })

        await t.test("testing /entries/byauthor/abcdefghij - not found, 0", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/bypublisher/abcdefghij", {
                method: 'GET',
            });
            const body = await request.json();
            assert.equal(body.hits.total.value === 0, true);
        })

        /** /entries/random */
        await t.test("testing /entries/random/10 - should return 10", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/random/10", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            assert.equal(body.hits.hits.length === 10, true);
        })

        await t.test("testing /entries/random/x - invalid number (422)", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/entries/random/x", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 422);
        })

    })
})

