import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ELASTIC_PASSWORD ||= "social-test-password";
const { default: router } = await import("../social/social.js");

const renderPreview = async (route, params) => {
  const handler = router.stack.find((layer) => layer.route?.path === route).route.stack[0].handle;
  let html;
  const req = {
    params,
    protocol: "http",
    get: (header) => header === "host" ? "localhost:8201" : undefined,
  };
  await handler(req, { send: (body) => { html = body; } });
  return html;
};

const renderLetter = (letter) => renderPreview("/letter/:letter", { letter });

test("letter preview uses the API total rather than the page size", async (context) => {
  context.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), `http://127.0.0.1:${process.env.PORT || 3000}/v5/entries/byletter/a?mode=tiny&size=0&offset=0`);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response("{}", { headers: { "X-Total-Count": "143" } });
  });
  const html = await renderLetter("a");
  assert.ok(html.includes('property="og:description" content="Games starting with  letter: a - 143 titles found"'));
});

test("letter preview encodes # and includes a zero total", async (context) => {
  context.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(String(url), `http://127.0.0.1:${process.env.PORT || 3000}/v5/entries/byletter/%23?mode=tiny&size=0&offset=0`);
    return new Response("{}", { headers: { "X-Total-Count": "0" } });
  });
  const html = await renderLetter("#");
  assert.ok(html.includes('property="og:description" content="Games starting with number - 0 titles found"'));
});

for (const scenario of ["http error", "missing total", "invalid total", "network error"]) {
  test(`letter preview retains its description on ${scenario}`, async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
      if (scenario === "network error") {
        throw new Error("Connection failed");
      }
      return new Response("{}", {
        status: scenario === "http error" ? 500 : 200,
        headers: scenario === "invalid total" ? { "X-Total-Count": "invalid" } : {},
      });
    });
    const html = await renderLetter("a");
    assert.ok(html.includes('property="og:description" content="Games starting with  letter: a"'));
    assert.ok(!html.includes("titles found"));
  });
}

for (const [name, total] of [["Ocean Software", "143"], ["Ocean/Software", "0"]]) {
  test(`publisher preview encodes ${name} and includes ${total} titles`, async (context) => {
    let requestedUrl;
    context.mock.method(globalThis, "fetch", async (url, options) => {
      requestedUrl = String(url);
      assert.ok(options.signal instanceof AbortSignal);
      return new Response("{}", { headers: { "X-Total-Count": total } });
    });
    const html = await renderPreview("/publisher/:name", { name });
    assert.equal(requestedUrl, `http://127.0.0.1:${process.env.PORT || 3000}/v5/entries/bypublisher/${encodeURIComponent(name)}?mode=tiny&size=0&offset=0&titlesonly=false`);
    assert.ok(html.includes(`property="og:description" content="Publisher: ${name} - ${total} titles found"`));
    assert.ok(html.includes(`property="og:url" content="http://localhost:8201/publisher/${encodeURIComponent(name)}"`));
  });
}

for (const scenario of ["http error", "missing total", "invalid total", "network error"]) {
  test(`publisher preview retains its description on ${scenario}`, async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
      if (scenario === "network error") {
        throw new Error("Connection failed");
      }
      return new Response("{}", {
        status: scenario === "http error" ? 500 : 200,
        headers: scenario === "invalid total" ? { "X-Total-Count": "invalid" } : {},
      });
    });
    const html = await renderPreview("/publisher/:name", { name: "Ocean Software" });
    assert.ok(html.includes('property="og:description" content="Publisher: Ocean Software"'));
    assert.ok(!html.includes("titles found"));
  });
}

for (const [name, total] of [["Matthew Smith", "143"], ["Author/Name", "0"]]) {
  test(`author preview encodes ${name} and includes ${total} titles`, async (context) => {
    let requestedUrl;
    context.mock.method(globalThis, "fetch", async (url, options) => {
      requestedUrl = String(url);
      assert.ok(options.signal instanceof AbortSignal);
      return new Response("{}", { headers: { "X-Total-Count": total } });
    });
    const html = await renderPreview("/author/:name", { name });
    assert.equal(requestedUrl, `http://127.0.0.1:${process.env.PORT || 3000}/v5/entries/byauthor/${encodeURIComponent(name)}?mode=tiny&includeagg=true&size=21&offset=0&titlesonly=false`);
    assert.ok(html.includes(`property="og:description" content="Author: ${name} - ${total} titles found"`));
    assert.ok(html.includes(`property="og:url" content="http://localhost:8201/author/${encodeURIComponent(name)}"`));
  });
}

for (const scenario of ["http error", "missing total", "invalid total", "network error"]) {
  test(`author preview retains its description on ${scenario}`, async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
      if (scenario === "network error") {
        throw new Error("Connection failed");
      }
      return new Response("{}", {
        status: scenario === "http error" ? 500 : 200,
        headers: scenario === "invalid total" ? { "X-Total-Count": "invalid" } : {},
      });
    });
    const html = await renderPreview("/author/:name", { name: "Matthew Smith" });
    assert.ok(html.includes('property="og:description" content="Author: Matthew Smith"'));
    assert.ok(!html.includes("titles found"));
  });
}