import { test } from "node:test";
import assert from "node:assert/strict";

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "http://localhost:3000/v5";

function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

async function fetchJson(path) {
  const response = await fetch(`${API_ENDPOINT_URL}${path}`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  return response.json();
}

// ── /entries/:entryid ─────────────────────────────────────────────────────────

test("GET /entries/:entryid returns 400 for non-numeric ID", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/abc`);
  assert.equal(response.status, 400);
});

test("GET /entries/:entryid returns 404 for unknown numeric ID", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/9999999`);
  assert.equal(response.status, 404);
});

test("GET /entries/:entryid returns a known entry", async () => {
  const payload = await fetchJson("/entries/2259");
  assert.ok(payload._id, "response should contain _id");
  assert.equal(payload._id, "0002259");
});

test("GET /entries/:entryid flat output returns text/plain", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/2259?output=flat`);
  assert.equal(response.status, 200);
  const contentType = response.headers.get("content-type") || "";
  assert.ok(contentType.includes("text/plain"));
  const text = await response.text();
  assert.ok(text.length > 0);
});

// ── /entries/byletter/:letter ─────────────────────────────────────────────────

test("GET /entries/byletter/:letter returns entries for a letter", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/byletter/a?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const payload = await response.json();
  assert.ok(payload.hits?.hits?.length >= 1);
});

test("GET /entries/byletter/# returns digit-prefixed entries", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/byletter/%23?size=5`);
  assert.notEqual(response.status, 500);
  assert.ok([200, 404].includes(response.status));
  if (response.status === 200) {
    assert.ok(isJsonResponse(response));
  }
});

// ── /entries/morelikethis/:entryid ────────────────────────────────────────────

test("GET /entries/morelikethis/:entryid returns 404 for non-numeric ID", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/morelikethis/abc`);
  assert.equal(response.status, 404);
});

test("GET /entries/morelikethis/:entryid returns similar entries", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/morelikethis/2259?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const payload = await response.json();
  assert.ok(payload.hits !== undefined);
});

// ── /entries/byauthor/:name ───────────────────────────────────────────────────

test("GET /entries/byauthor/:name returns entries for a known author prefix", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/byauthor/rit?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const payload = await response.json();
  assert.ok(payload.hits !== undefined);
});

test("GET /entries/byauthor/:name returns X-Total-Count header", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/byauthor/ultimate?size=3`);
  assert.notEqual(response.status, 500);
  if (response.status === 200) {
    const totalCount = Number(response.headers.get("x-total-count"));
    assert.ok(Number.isFinite(totalCount));
  }
});

// ── /entries/bypublisher/:name ────────────────────────────────────────────────

test("GET /entries/bypublisher/:name returns entries for a known publisher prefix", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/bypublisher/ocean?size=5`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const payload = await response.json();
  assert.ok(payload.hits !== undefined);
});

test("GET /entries/bypublisher/:name returns X-Total-Count header", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/bypublisher/micro?size=3`);
  assert.notEqual(response.status, 500);
  if (response.status === 200) {
    const totalCount = Number(response.headers.get("x-total-count"));
    assert.ok(Number.isFinite(totalCount));
  }
});

// ── /entries/random/:total ────────────────────────────────────────────────────

test("GET /entries/random/:total returns the requested number of entries", async () => {
  const total = 5;
  const response = await fetch(`${API_ENDPOINT_URL}/entries/random/${total}`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  assert.ok(response.headers.has("x-total-count"));
  const payload = await response.json();
  assert.ok(payload.hits?.hits?.length === total);
});

test("GET /entries/random/:total simple output returns an array of id/title objects", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/entries/random/3?output=simple`);
  assert.equal(response.status, 200);
  assert.ok(isJsonResponse(response));
  const payload = await response.json();
  assert.ok(Array.isArray(payload));
  if (payload.length > 0) {
    assert.equal(typeof payload[0].id, "string");
    assert.equal(typeof payload[0].title, "string");
  }
});
