import { test } from "node:test";
import assert from "node:assert/strict";

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "http://localhost:3000/v5";

test("GET /typeahead/ALL/:query returns JSON array", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/typeahead/ALL/zx81`);
  assert.equal(response.status, 200);

  const contentType = response.headers.get("content-type") || "";
  assert.ok(contentType.includes("application/json"));

  const payload = await response.json();
  assert.ok(Array.isArray(payload));
  assert.ok(payload.length >= 1);
});

test("GET /typeahead/:context/:query returns 422 for invalid context", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/typeahead/X/zx81`);
  assert.equal(response.status, 422);
});

test("GET /typeahead/LICENSE/:query sets X-Total-Count header", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/typeahead/LICENSE/kaffe`);
  assert.equal(response.status, 200);

  const totalCountHeader = response.headers.get("x-total-count");
  assert.notEqual(totalCountHeader, null);

  const totalCount = Number(totalCountHeader);
  assert.ok(Number.isFinite(totalCount));

  const payload = await response.json();
  assert.ok(Array.isArray(payload));
});
