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
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /href="\/x402"/);
  assert.match(html, /href="\/trumark"/);
  assert.match(html, /href="\/made-in-america"/);
  assert.match(html, /href="\/partners\/brief"/);
  assert.match(html, /Start DPP checkout/);
  assert.match(html, /Issue seals\. Bind products\. Verify anywhere\./);
  assert.match(html, /--bg: #ffffff/);
  assert.match(html, /--accent: #4F46E5/);
  assert.doesNotMatch(html, /FedRAMP/);
  assert.doesNotMatch(html, /NSF award/);
});

test("/pricing is a real catalogue page, not a 404", async () => {
  const res = await get("/pricing");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Pricing — AuthiChain<\/title>/);
  assert.match(html, /AuthiChain Starter/);
  assert.match(html, /\$299\/mo/);
  assert.match(html, /https:\/\/buy\.stripe\.com\/28E8wP0EVf7M6mefTS1Nu1p/);
  assert.match(html, /\$299/);
  assert.match(html, /href="\/api\/checkout\/dpp"/);
  assert.match(html, /href="\/x402"/);
});

test("/contact is a real page, not the homepage", async () => {
  const res = await get("/contact");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /hello@authichain\.com/);
  assert.match(html, /<title>Contact AuthiChain<\/title>/);
});

test("/x402 is public HTML for the live agent-pay rail", async () => {
  for (const path of ["/x402", "/x402/", "/docs/x402"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/, path);
    const html = await res.text();
    assert.match(html, /<title>x402 agent pay — AuthiChain<\/title>/);
    assert.match(html, /<main id="main">/);
    assert.match(html, /--ac-accent:/);
    assert.match(html, /0x5db511706FB6317cd23A7655F67450c5AC6e6AA2/);
    assert.match(html, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
    assert.match(html, /\$0\.05/);
    assert.match(html, /https:\/\/authichain\.com\/api\/x402\/health/);
    assert.match(html, /curl -sS https:\/\/authichain\.com\/api\/x402\/health/);
    assert.match(
      html,
      /curl -sS -i -X POST https:\/\/authichain\.com\/api\/x402/
    );
    assert.ok(
      !html.toLowerCase().includes("facilitator.payai"),
      `${path} must not publish the facilitator URL`
    );
    assert.ok(
      !html.includes("PRIVATE") && !html.includes("secret"),
      `${path} must not mention secrets`
    );
  }
});

test("homepage and /dpp link to /x402", async () => {
  const home = await (await get("/")).text();
  assert.match(home, /href="\/x402"/);
  const dpp = await (await get("/dpp")).text();
  assert.match(dpp, /href="\/x402"/);
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

test("GET /api/x402, /health, and /api/v1/agent-verify are answered here", async () => {
  for (const path of [
    "/api/x402",
    "/api/x402/health",
    "/api/v1/agent-verify",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, "not_configured", path);
  }
});

test("other /api paths still proxy to the app", async () => {
  const res = await get("/api/automation/cron");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "app");
});

test("/demo sends buyers to /pricing, not the legacy SPA /subscriptions catalogue", async () => {
  const res = await get("/demo");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://authichain.com/pricing");
});

test("/demo/strainchain lands on the TruMark money surface", async () => {
  const res = await get("/demo/strainchain");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://authichain.com/trumark");
});

test("/partners lands on the Made in America money surface", async () => {
  const res = await get("/partners");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://authichain.com/made-in-america");
});

test("TruMark and Made in America pages are live with checkout CTAs", async () => {
  const trumark = await get("/trumark");
  assert.equal(trumark.status, 200);
  const trumarkHtml = await trumark.text();
  assert.match(trumarkHtml, /href="\/api\/checkout\/plan\/strainchain_passport"/);
  assert.match(trumarkHtml, /href="\/api\/checkout\/dpp"/);
  assert.doesNotMatch(trumarkHtml, /calendly/i);
  assert.doesNotMatch(trumarkHtml, /schedule a (call|demo)/i);

  for (const path of ["/made-in-america", "/partners/brief", "/ftc-shield"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /href="\/api\/checkout\/dpp"/, path);
    assert.doesNotMatch(html, /calendly/i);
    assert.doesNotMatch(html, /schedule a (call|demo)/i);
  }
});

test("app.authichain.com/ 302s to /dashboard", async () => {
  const res = await worker.fetch(
    new Request("https://app.authichain.com/", {
      headers: { host: "app.authichain.com" },
    }),
    ENV
  );
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/dashboard");
});

test("/dashboard and /generate are proxied to the app", async () => {
  for (const path of [
    "/dashboard",
    "/generate",
    "/api/automation/cron",
    "/api/generate",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(
      await res.text(),
      "app",
      `${path} should come from APP_WORKER`
    );
  }
});

test("/p and /p/<serial> are proxied to the app, not marketing 404", async () => {
  for (const path of ["/p", "/p/", "/p/CERT-001", "/p/test"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(
      await res.text(),
      "app",
      `${path} should come from APP_WORKER`
    );
  }
  // /pricing must stay on the landing worker — prefix /p is boundary-aware.
  const pricing = await get("/pricing");
  assert.equal(pricing.status, 200);
  assert.match(await pricing.text(), /<title>Pricing — AuthiChain<\/title>/);
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
  assert.ok(xml.includes("<loc>https://authichain.com/pricing</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/onboard</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/dpp</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/genetics</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/passport</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/trumark</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/made-in-america</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/partners/brief</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/verify</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/x402</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/blog/eu-dpp-manufacturer</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/vs/everledger</loc>"));
});

test("EU DPP manufacturer article is a public page with live checkout CTA", async () => {
  for (const path of ["/blog/eu-dpp-manufacturer", "/blog/eu-dpp-manufacturer/"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /Why AuthiChain is built for the next generation of product trust/);
    assert.match(html, /href="\/api\/checkout\/dpp"/);
    assert.match(html, /Start DPP checkout/);
    assert.doesNotMatch(html, /AuthiChain Inc/i);
    assert.match(html, /ZACHARY KIETZMAN/);
  }
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
