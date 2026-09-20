/**
 * strainchain.io 404 handling.
 *
 * Complements routing.test.ts, which guards that passport and genetics paths
 * leave this worker. This file guards the other half: that a path which is
 * neither a passport route nor the apex stops being answered with marketing
 * copy at HTTP 200.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const ENV = { APP_ORIGIN: "https://app.example.com" };

async function get(path: string) {
  return worker.fetch(new Request(`https://strainchain.io${path}`), ENV);
}

test("an unknown path is a 404, not the homepage at 200", async () => {
  for (const path of ["/nope-xyz123", "/deep/unknown/path"]) {
    const res = await get(path);
    assert.equal(res.status, 404, `${path} should 404`);
    assert.match(await res.text(), /does not exist/);
  }
});

test("the apex still renders the marketing page", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /StrainChain/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /--bg: #ffffff/);
});

test("the sitemap lists only real URLs and no fragments", async () => {
  const xml = await (await get("/sitemap.xml")).text();
  assert.ok(!xml.includes("/#"), "fragment URLs are not distinct pages");
  assert.ok(xml.includes("genetics/mendo-love-farms"));
  assert.ok(xml.includes("<loc>https://strainchain.io/pricing</loc>"));
});

test("the 404 escapes the path, so a hostile URL cannot inject markup", async () => {
  const html = await (await get("/%3Cscript%3Ealert(1)%3C/script%3E")).text();
  assert.ok(
    !html.includes("<script>alert(1)</script>"),
    "path must be escaped"
  );
});
