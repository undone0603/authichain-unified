/**
 * authichain.com path routing and sitemap truthfulness.
 *
 * The fault being guarded: this worker used to end with an unconditional
 * `return new Response(HTML)`, so every unmatched URL answered 200 with the
 * homepage. That made the sitemap unfalsifiable — it could list /about, /book
 * and /authichain/pilots, none of which had a handler anywhere, and every one
 * would "work". The last test here is the point of the whole file: it walks the
 * sitemap this worker serves and requires every URL in it to really resolve.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

type Env = Parameters<typeof worker.fetch>[1];

/** APP_WORKER stands in for the service binding, which local tests do not have. */
const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

async function get(path: string, env: Env = ENV) {
  return worker.fetch(new Request(`https://authichain.com${path}`), env);
}

test("an unknown path is a 404, not the homepage at 200", async () => {
  for (const path of [
    "/nope-xyz123",
    "/about",
    "/book",
    "/authichain/pilots",
    "/deep/unknown",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 404, `${path} should 404`);
  }
});

test("the apex still renders the homepage", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /href="\/api\/checkout\/dpp"/);
  assert.match(html, /--bg: #ffffff/);
});

test("/contact is a real page, not the homepage", async () => {
  const res = await get("/contact");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /hello@authichain\.com/);
  assert.match(html, /<title>Contact AuthiChain<\/title>/);
});

test("every comparison page renders, including the new /vs/everledger", async () => {
  for (const slug of ["scantrust", "circularise", "vechain", "everledger"]) {
    const res = await get(`/vs/${slug}`);
    assert.equal(res.status, 200, `/vs/${slug} should render`);
    assert.match(await res.text(), /Head-to-Head Comparison/);
  }
  const everledger = await (await get("/vs/everledger")).text();
  assert.match(everledger, /AuthiChain vs Everledger/);
});

test("the /vs index lists every comparison", async () => {
  const html = await (await get("/vs")).text();
  for (const name of ["Scantrust", "Circularise", "VeChain", "Everledger"]) {
    assert.match(html, new RegExp(name));
  }
});

test("an invented competitor slug is a 404, not the index at 200", async () => {
  const res = await get("/vs/not-a-real-company");
  assert.equal(res.status, 404);
});

test("a malformed certificate id is a 404", async () => {
  assert.equal((await get("/cert/AC-1234ABCD")).status, 200);
  assert.equal((await get("/cert/garbage")).status, 404);
});

test("/thanks and /success serve the DPP thanks page", async () => {
  for (const path of ["/thanks", "/success"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(await res.text(), /Payment received/);
  }
});

test("anchor Sign In stays on an apex path, not app.login", async () => {
  const html = await (await get("/anchor")).text();
  assert.equal((await get("/anchor")).status, 200);
  assert.ok(!html.includes("app.authichain.com/login"));
  assert.match(html, /href="\/onboard"/);
});

test("DPP landing CTA uses /onboard, not a dead /authenticate", async () => {
  const html = await (await get("/digital-product-passport")).text();
  assert.match(html, /href="\/onboard"/);
  assert.ok(!html.includes('href="/authenticate"'));
});

test("/dapp redirects to /dashboard (estate CTA)", async () => {
  const res = await get("/dapp");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://authichain.com/dashboard");
});

test("/dashboard and /generate are proxied to the app", async () => {
  for (const path of ["/dashboard", "/generate", "/api/automation/cron"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(
      await res.text(),
      "app",
      `${path} should come from APP_WORKER`
    );
  }
});

test("/authenticate is proxied to the app rather than answered with marketing", async () => {
  const res = await get("/authenticate");
  assert.equal(res.status, 200);
  assert.equal(
    await res.text(),
    "app",
    "should come from APP_WORKER, not the homepage"
  );
});

test("the 404 escapes the path, so a hostile URL cannot inject markup", async () => {
  const res = await get("/%3Cscript%3Ealert(1)%3C/script%3E");
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.ok(
    !html.includes("<script>alert(1)</script>"),
    "path must be escaped"
  );
});

test("the sitemap no longer lists pages that do not exist", async () => {
  const xml = await (await get("/sitemap.xml")).text();
  for (const gone of [
    "/about",
    "/book",
    "/authichain",
    "/authichain/technology",
    "/authichain/pilots",
  ]) {
    assert.ok(
      !xml.includes(`<loc>https://authichain.com${gone}</loc>`),
      `${gone} should be gone`
    );
  }
  assert.ok(xml.includes("<loc>https://authichain.com/contact</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/vs/everledger</loc>"));
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
  assert.match(
    await robots.text(),
    /Sitemap: https:\/\/authichain.com\/sitemap.xml/
  );
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
});

test("every URL the sitemap claims actually resolves", async () => {
  const xml = await (await get("/sitemap.xml")).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.length > 0, "sitemap should not be empty");
  for (const loc of locs) {
    const path = new URL(loc).pathname;
    const res = await get(path);
    assert.ok(
      res.status >= 200 && res.status < 400,
      `sitemap lists ${path} but it answered ${res.status}`
    );
  }
});
