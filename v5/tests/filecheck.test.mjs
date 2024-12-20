import { test, describe } from 'node:test';
import assert from 'node:assert';

const API_ENDPOINT_URL = "http://localhost:3000/v5/";

describe("Testing `filecheck` API endpoint", function () {
    test("running tests on API", async function (t) {
        await t.test("testing /filecheck md5 ", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/filecheck/82bb33587530d337323ef3cd4456d4c4", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            // console.log(`returned: ${body.length} entrie(s)`);
            assert.equal(body.title === "Head over Heels", true);
        })
    })

    test("running tests on API", async function (t) {
        await t.test("testing /filecheck md5 ", async (t) => {
            const request = await fetch(API_ENDPOINT_URL + "/filecheck/d4792184f2e471c4cc38e6f1f234ab4276c537224d2ca2f19f0b36695afc9a03ac4fb5dd4afdf549384725a91901221de825867627fac019ef0f5e033561f3a4", {
                method: 'GET',
            });
            assert.strictEqual(request.status, 200);
            const body = await request.json();
            // console.log(`returned: ${body.length} entrie(s)`);
            assert.equal(body.title === "SQIJ 2018", true);
        })
    })
})

