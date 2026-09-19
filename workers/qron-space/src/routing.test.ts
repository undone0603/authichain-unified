/**
 * qron.space path routing.
 *
 * The fault being guarded: every URL on this domain fell through to the same
 * marketing page at HTTP 200, so unknown paths were indistinguishable from real
 * ones and the sitemap's five #fragment entries looked like five pages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

/** The homepage fetches a YouTube RSS feed; tests must not reach the network. */
function stubFetch() {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("<feed></feed>", {
      status: 200,
      headers: { "content-type": "application/xml" },
    })) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

async function get(path: string, env?: { APP_ORIGIN?: string }) {
  return worker.fetch(new Request(`https://qron.space${path}`), env);
}

test("an unknown path is a 404, not the homepage at 200", async () => {
  for (const path of ["/nope-xyz123", "/staking", "/deep/unknown/path"]) {
    const res = await get(path);
    assert.equal(res.status, 404, `${path} should 404`);
    assert.match(await res.text(), /does not exist/);
  }
});

test("a 404 is answered without reaching the network", async () => {
  // The guard runs before the YouTube fetch: an unknown path must not cost an
  // outbound request. Leaving fetch unstubbed here proves it.
  const res = await get("/definitely-not-a-page");
  assert.equal(res.status, 404);
});

test("the apex still renders the marketing page", async () => {
  const f = stubFetch();
  try {
    const res = await get("/");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /QRON/);
    assert.match(html, /href="\/generate"/);
    assert.match(html, /--bg: #ffffff/);
  } finally {
    f.restore();
  }
});

test("/health still answers", async () => {
  const res = await get("/health");
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { status: string }).status, "ok");
});

test("the sitemap lists only real URLs and no fragments", async () => {
  const xml = await (await get("/sitemap.xml")).text();
  assert.ok(!xml.includes("/#"), "fragment URLs are not distinct pages");
  assert.ok(xml.includes("<loc>https://qron.space/</loc>"));
  assert.ok(xml.includes("<loc>https://qron.space/generate</loc>"));
});

test("IndexNow key file is served as short-cache plain text", async () => {
  const res = await get("/authichain2026indexnow.txt");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(await res.text(), "authichain2026indexnow");
  assert.equal((await get("/authichain2026indexnow.txt/")).status, 404);
});

test("robots and sitemap still answer after the IndexNow route", async () => {
  const robots = await get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/qron.space\/sitemap.xml/);
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
});

test("/generate is proxied to the app, not answered with a 404", async () => {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("generate", { status: 200 });
  }) as typeof fetch;
  try {
    const res = await get("/generate", { APP_ORIGIN: "https://app.example.com" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "qron-space-proxy");
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/generate");
  } finally {
    globalThis.fetch = real;
  }
});

test("the 404 escapes the path, so a hostile URL cannot inject markup", async () => {
  const html = await (await get("/%3Cscript%3Ealert(1)%3C/script%3E")).text();
  assert.ok(
    !html.includes("<script>alert(1)</script>"),
    "path must be escaped"
  );
});
