import { test } from "node:test";
import assert from "node:assert/strict";

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "http://localhost:3000/v5";

function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

test("GET /filesearch/:text returns 404 for unlikely term", async () => {
  const query = "unlikely_search_term_zzxxyyqq_2026";
  const response = await fetch(`${API_ENDPOINT_URL}/filesearch/${query}`);

  assert.equal(response.status, 404);
});

test("GET /filesearch/:text handles standard query without server error", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/filesearch/spectrum?offset=0&size=5`);

  assert.notEqual(response.status, 500);
  assert.ok([200, 404].includes(response.status));

  if (response.status === 200) {
    assert.ok(isJsonResponse(response));
    const payload = await response.json();
    assert.ok(Array.isArray(payload));
    assert.ok(payload.length >= 1);
    assert.ok(response.headers.has("x-total-count"));
  }
});
