import { test } from "node:test";
import assert from "node:assert/strict";

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "http://localhost:3000/v5";

function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

// ── GET /search ───────────────────────────────────────────────────────────────

test("GET /search returns entries with X-Total-Count header", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const totalCount = Number(response.headers.get("x-total-count"));
  assert.ok(Number.isFinite(totalCount) && totalCount > 0);
});

test("GET /search with contenttype filter returns filtered results", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search?size=5&contenttype=SOFTWARE`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
});

test("GET /search with simple output returns id/title array", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search?size=3&output=simple`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  const payload = await response.json();
  assert.ok(Array.isArray(payload));
  if (payload.length > 0) {
    assert.equal(typeof payload[0].id, "string");
    assert.equal(typeof payload[0].title, "string");
  }
});

// ── GET /search/:searchterm ───────────────────────────────────────────────────

test("GET /search/:searchterm returns 422 for empty-ish term", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/%20`);
  assert.equal(response.status, 422);
  assert.ok(isJsonResponse(response));
  const payload = await response.json();
  assert.equal(typeof payload.error, "string");
});

test("GET /search/:searchterm returns results for a known title", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/manic%20miner?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const totalCount = Number(response.headers.get("x-total-count"));
  assert.ok(totalCount >= 1);
});

test("GET /search/:searchterm with includeagg returns aggregations", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/manic?size=3&includeagg=true`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  const payload = await response.json();
  assert.ok(payload.aggregations !== undefined);
});

// ── GET /search/titles/:searchterm ───────────────────────────────────────────

test("GET /search/titles/:searchterm returns title-matched results", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/titles/manic?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const totalCount = Number(response.headers.get("x-total-count"));
  assert.ok(totalCount >= 1);
});

test("GET /search/titles/:searchterm returns 422 for empty term", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/titles/%20`);
  assert.equal(response.status, 422);
});

// ── GET /search/screens/:searchterm ──────────────────────────────────────────

test("GET /search/screens/:searchterm does not return a server error", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/screens/loading?size=5`);
  assert.notEqual(response.status, 500);
  assert.ok([200, 404].includes(response.status));
  if (response.status === 200) {
    assert.ok(isJsonResponse(response));
    assert.ok(response.headers.has("x-total-count"));
  }
});

test("GET /search/screens/:searchterm returns 422 for empty term", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/screens/%20`);
  assert.equal(response.status, 422);
});
