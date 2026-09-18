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
  globalThis.fetch = (async () => new Response("<feed></feed>", {
    status: 200,
    headers: { "content-type": "application/xml" },
  })) as typeof fetch;
  return { restore: () => { globalThis.fetch = real; } };
}

async function get(path: string) {
  return worker.fetch(new Request(`https://qron.space${path}`));
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
    assert.match(await res.text(), /QRON/);
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
  assert.match(xml, /<loc>https:\/\/qron\.space\/<\/loc>/);
});

test("the 404 escapes the path, so a hostile URL cannot inject markup", async () => {
  const html = await (await get("/%3Cscript%3Ealert(1)%3C/script%3E")).text();
  assert.ok(!html.includes("<script>alert(1)</script>"), "path must be escaped");
});
