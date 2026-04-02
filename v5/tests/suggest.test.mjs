import { test } from "node:test";
import assert from "node:assert/strict";

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "http://localhost:3000/v5";

async function fetchJson(path) {
  const response = await fetch(`${API_ENDPOINT_URL}${path}`);
  assert.equal(response.status, 200);

  const contentType = response.headers.get("content-type") || "";
  assert.ok(contentType.includes("application/json"));

  return response.json();
}

test("GET /suggest/:query returns a JSON array", async () => {
  const payload = await fetchJson("/suggest/head");

  assert.ok(Array.isArray(payload));
});

test("GET /suggest/author/:name returns author suggestions array", async () => {
  const payload = await fetchJson("/suggest/author/rit");

  assert.ok(Array.isArray(payload));

  if (payload.length > 0) {
    assert.equal(typeof payload[0].text, "string");
  }
});

test("GET /suggest/publisher/:name returns publisher suggestions array", async () => {
  const payload = await fetchJson("/suggest/publisher/oce");

  assert.ok(Array.isArray(payload));

  if (payload.length > 0) {
    assert.equal(typeof payload[0].text, "string");
  }
});
