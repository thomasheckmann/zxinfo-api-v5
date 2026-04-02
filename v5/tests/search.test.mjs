import { test } from "node:test";
import assert from "node:assert/strict";

const API_ENDPOINT_URL = process.env.API_ENDPOINT_URL || "http://localhost:3000/v5";

test("GET /search/titles/:searchterm returns flat text output", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/titles/manic`);
  assert.equal(response.status, 200);

  const contentType = response.headers.get("content-type") || "";
  assert.ok(contentType.includes("text/html") || contentType.includes("text/plain"));

  const payload = await response.text();
  assert.ok(payload.length > 0);
  assert.ok(payload.includes("r=") || payload.includes("-"));
});

test("GET /search/titles/:searchterm returns X-Total-Count header", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/titles/manic`);
  assert.equal(response.status, 200);

  const totalCount = response.headers.get("x-total-count");
  assert.notEqual(totalCount, null);
  assert.ok(Number.isFinite(Number(totalCount)));
});

test("GET /search/titles/:searchterm rejects empty search", async () => {
  const response = await fetch(`${API_ENDPOINT_URL}/search/titles/%20`);
  assert.equal(response.status, 422);
});

test("GET /search/titles/:searchterm rejects oversized search", async () => {
  const oversized = "a".repeat(201);
  const response = await fetch(`${API_ENDPOINT_URL}/search/titles/${encodeURIComponent(oversized)}`);
  assert.equal(response.status, 422);
});
