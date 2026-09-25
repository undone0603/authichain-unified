/**
 * govchain.us path routing.
 *
 * The fault being guarded: every URL on this domain used to fall through to the
 * same marketing page at HTTP 200, so an unknown path, a mistyped notice id and
 * a real opportunity were indistinguishable to a crawler or an uptime check.
 * The homepage's own live feed suffered the same bug from the other side — it
 * fetched /api/govchain/* and got HTML back, so it always rendered its fallback.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402.ts";
import worker from "./index.ts";

const GATED_DPP_ACTION = new URL("/checkout/dpp_readiness", "https://authichain.com").href;

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-test-key",
  APP_ORIGIN: "https://app.example.com",
};

type StubRow = Record<string, unknown>;

/** Serves canned PostgREST responses and records the URLs asked for. */
function stubSupabase(rows: StubRow[], count = rows.length) {
  const calls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: Request | string | URL) => {
    const href = input instanceof Request ? input.url : String(input);
    calls.push(href);
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": `0-0/${count}`,
      },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

async function get(path: string, env: Partial<typeof ENV> = ENV) {
  return worker.fetch(
    new Request(`https://govchain.us${path}`),
    env as typeof ENV
  );
}

/** Parse sitemap <loc> values as https URLs — do not concatenate schemes. */
function sitemapHttpsLocs(xml: string): URL[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => {
    const url = new URL(match[1]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "govchain.us");
    return url;
  });
}

/** Parse robots `# https://…` comment URLs — do not substring-match hosts. */
function robotsHttpsCommentPaths(text: string): string[] {
  return [...text.matchAll(/^# (https:\/\/\S+)/gm)].map(match => {
    const url = new URL(match[1]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "govchain.us");
    return url.pathname;
  });
}

const ROW = {
  notice_id: "ABC123",
  title: "Cyber support services",
  agency: "GSA",
  deadline: "2026-11-01T00:00:00Z",
  naics_code: "541512",
  fit_score: 88,
  sam_url: "https://sam.gov/opp/ABC123/view",
  status: "scored",
};

test("an unknown path is a 404, not the homepage at 200", async () => {
  for (const path of ["/nope-xyz123", "/deep/unknown/path"]) {
    const res = await get(path);
    assert.equal(res.status, 404, `${path} should 404`);
    const body = await res.text();
    assert.match(body, /does not exist/);
    assert.doesNotMatch(body, /Federal Contract Intelligence &/);
  }
});

test("the apex still renders the marketing page", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Federal Contract Intelligence/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /--bg: #ffffff/);
});

test("the sitemap lists only real URLs and no fragments", async () => {
  const res = await get("/sitemap.xml");
  const xml = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!xml.includes("/#"), "fragment URLs are not distinct pages");
  const paths = sitemapHttpsLocs(xml).map(url => url.pathname);
  assert.ok(paths.includes("/opportunities"));
  assert.ok(paths.includes("/onboard"));
  assert.ok(paths.includes("/pricing"));
  assert.ok(paths.includes("/gift"));
  assert.ok(paths.includes("/llms.txt"));
  assert.ok(paths.includes("/openapi.json"));
  assert.ok(paths.includes("/api/x402"));
  assert.ok(paths.includes("/mcp"));
  assert.ok(!xml.includes("/rfp"));
  assert.ok(!xml.includes("/compliance"));
  assert.equal(xml.includes("/api/checkout"), false);
});

test("/llms.txt and /openapi.json point agents at Payment Links and unpaid POST x402", async () => {
  const llms = await get("/llms.txt");
  assert.equal(llms.status, 200);
  const text = await llms.text();
  assert.match(text, /POST https:\/\/govchain\.us\/api\/x402/);
  assert.ok(text.includes(planPaymentLink("dpp_readiness") ?? ""));
  assert.ok(text.includes(planPaymentLink("strainchain_passport") ?? ""));
  assert.equal(
    `href="${planPaymentLink("dpp_readiness")}"`.startsWith(
      'href="https://authichain.com/checkout/'
    ),
    true
  );
  assert.doesNotMatch(text, /GET \/api\/checkout/);

  const specRes = await get("/openapi.json");
  assert.equal(specRes.status, 200);
  const spec = (await specRes.json()) as {
    openapi: string;
    servers: Array<{ url: string }>;
    paths: {
      "/api/x402": {
        get?: { responses: { "200": unknown } };
        post: {
          "x-payment-info": { protocols: string[] };
          responses: { "402": unknown };
        };
      };
    };
  };
  assert.equal(spec.openapi, "3.1.0");
  assert.deepEqual(spec.servers, [{ url: "https://govchain.us" }]);
  assert.ok(spec.paths["/api/x402"].get?.responses["200"]);
  assert.deepEqual(spec.paths["/api/x402"].post["x-payment-info"].protocols, [
    "x402",
  ]);
  assert.ok(spec.paths["/api/x402"].post.responses["402"]);
});

test("unpaid POST /api/x402 is 402 v2 with published payTo; GET health is 200", async () => {
  const unpaid = await worker.fetch(
    new Request("https://govchain.us/api/x402", { method: "POST" }),
    ENV
  );
  assert.equal(unpaid.status, 402);
  const body = (await unpaid.json()) as {
    x402Version: number;
    resource?: { url?: string };
    accepts: Array<{ payTo: string; amount?: string }>;
    extensions?: { bazaar?: unknown };
  };
  assert.equal(body.x402Version, 2);
  assert.equal(body.resource?.url, "https://govchain.us/api/x402");
  assert.equal(body.accepts[0].payTo, X402_PUBLISHED_PAY_TO);
  assert.equal(body.accepts[0].amount, "50000");
  assert.ok(body.extensions?.bazaar);
  assert.ok(unpaid.headers.get("PAYMENT-REQUIRED"));
  assert.equal(
    JSON.stringify(body).toLowerCase().includes("facilitator.payai"),
    false
  );

  for (const path of ["/api/x402", "/api/x402/health"]) {
    const health = await get(path);
    assert.equal(health.status, 200, path);
    const report = (await health.json()) as { payTo: string };
    assert.equal(report.payTo, X402_PUBLISHED_PAY_TO, path);
  }
});

test("/mcp and /api/mcp discover Payment Links instead of 404", async () => {
  for (const path of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const body = (await res.json()) as {
      protocol: string;
      pay: { x402: string };
      pricing: {
        humanCheckout: {
          passportPaymentLink?: string;
          dppPaymentLink?: string;
          farmPaymentLink?: string;
          starterPaymentLink?: string;
        };
      };
    };
    assert.equal(body.protocol, "mcp", path);
    assert.equal(body.pay.x402, "POST https://govchain.us/api/x402", path);
    assert.equal(
      body.pricing.humanCheckout.dppPaymentLink,
      planPaymentLink("dpp_readiness"),
      path
    );
    assert.equal(
      body.pricing.humanCheckout.passportPaymentLink,
      planPaymentLink("strainchain_passport"),
      path
    );
    assert.equal(
      body.pricing.humanCheckout.farmPaymentLink,
      planPaymentLink("strainchain_farm"),
      path
    );
    assert.equal(
      body.pricing.humanCheckout.starterPaymentLink,
      undefined,
      path
    );
    const blob = JSON.stringify(body);
    assert.equal(blob.includes("/api/checkout"), false, path);
    assert.equal(blob.toLowerCase().includes("facilitator.payai"), false, path);
  }

  const unpaid = await worker.fetch(
    new Request("https://govchain.us/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "verify" },
      }),
    }),
    ENV
  );
  assert.equal(unpaid.status, 402);
  const required = (await unpaid.json()) as {
    x402Version: number;
    resource?: { url?: string };
    accepts: Array<{ payTo: string }>;
  };
  assert.equal(required.x402Version, 2);
  assert.equal(required.resource?.url, "https://govchain.us/mcp");
  assert.equal(required.accepts[0].payTo, X402_PUBLISHED_PAY_TO);
});

test("GET /api/x402/catalog is 200 with Farm+Passport+DPP Payment Links", async () => {
  const res = await get("/api/x402/catalog");
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    catalog: string;
    humanCheckout: {
      farmPaymentLink?: string;
      passportPaymentLink?: string;
      dppPaymentLink?: string;
      starterPaymentLink?: string;
    };
  };
  assert.equal(body.catalog, "/api/x402/catalog");
  assert.equal(
    new URL(body.humanCheckout.farmPaymentLink ?? "").hostname,
    "authichain.com"
  );
  assert.equal(
    new URL(body.humanCheckout.passportPaymentLink ?? "").hostname,
    "authichain.com"
  );
  assert.equal(
    new URL(body.humanCheckout.dppPaymentLink ?? "").hostname,
    "authichain.com"
  );
  assert.equal(body.humanCheckout.starterPaymentLink, undefined);
  const blob = JSON.stringify(body);
  assert.equal(blob.includes("/api/checkout"), false);
  assert.equal(blob.toLowerCase().includes("facilitator.payai"), false);
});

test("/pricing is a live money page, not a 404", async () => {
  const res = await get("/pricing");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Pricing — GovChain<\/title>/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.match(html, /href="https:\/\/authichain\.com\/pricing"/);
  assert.doesNotMatch(html, /href="\/api\/checkout\//);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.doesNotMatch(html, /does not exist/);
});

test("free DoD packet is live, unpaid, and does not claim an award", async () => {
  for (const path of ["/gift", "/sbir-packet", "/apex-packet"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.ok(html.includes("Nothing here is an award"));
    const hrefs = [...html.matchAll(/\bhref="([^"]+)"/g)].map(m => m[1]);
    const actions = [...html.matchAll(/\baction="([^"]+)"/g)].map(m => m[1]);
    const isAppUrl = (raw: string, pathname: string) => {
      try {
        const u = new URL(raw);
        return (
          u.protocol === "https:" &&
          u.hostname === "authichain.govchain.us" &&
          u.pathname === pathname
        );
      } catch {
        return false;
      }
    };
    assert.ok(hrefs.some(h => isAppUrl(h, "/made-in-america")), path);
    assert.ok(
      hrefs.includes(
        "https://govchain.us/p/sbir-svip-blockchain-document-verification"
      ) || hrefs.includes("/p/sbir-svip-blockchain-document-verification"),
      path
    );
    assert.ok(hrefs.includes("/onboard"), path);
    assert.ok(
      actions.some(a => a === GATED_DPP_ACTION),
      path
    );
    assert.ok(!html.includes("SBIR awarded"));
    assert.ok(!html.includes("strainchain_farm"));
  }
});

test("landing-owned sitemap URLs resolve on this worker", async () => {
  for (const path of [
    "/",
    "/pricing",
    "/gift",
    "/llms.txt",
    "/openapi.json",
    "/api/x402",
    "/mcp",
  ]) {
    const res = await get(path);
    assert.ok(
      res.status >= 200 && res.status < 400,
      `${path} answered ${res.status}`
    );
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
  const robotsText = await robots.text();
  assert.match(robotsText, /Sitemap: https:\/\/govchain.us\/sitemap.xml/);
  const commentPaths = robotsHttpsCommentPaths(robotsText);
  assert.ok(commentPaths.includes("/llms.txt"));
  assert.ok(commentPaths.includes("/openapi.json"));
  assert.ok(commentPaths.includes("/api/x402"));
  assert.ok(commentPaths.includes("/mcp"));
  assert.doesNotMatch(robotsText, /GET \/api\/checkout/);
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
});

test("/p SEO hubs are proxied to the app, not answered with a 404", async () => {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit
  ) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("hub", { status: 200 });
  }) as typeof fetch;
  try {
    const res = await get("/p/government-document-verification-blockchain");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "govchain-us-proxy");
    assert.equal(calls.length, 1);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/p/government-document-verification-blockchain"
    );
  } finally {
    globalThis.fetch = real;
  }
});

test("seed canonicals 301 to /p/<slug>", async () => {
  const res = await get("/government-document-verification-blockchain");
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://govchain.us/p/government-document-verification-blockchain"
  );
});

test("/onboard is proxied to the app, not answered with a 404", async () => {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit
  ) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("onboard", { status: 200 });
  }) as typeof fetch;
  try {
    const res = await get("/onboard");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "govchain-us-proxy");
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/onboard");
  } finally {
    globalThis.fetch = real;
  }
});

test("/api/govchain/opportunities returns JSON the homepage can parse", async () => {
  const f = stubSupabase([ROW]);
  try {
    const res = await get("/api/govchain/opportunities?min_fit=70&limit=6");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = (await res.json()) as { opportunities: StubRow[] };
    assert.equal(body.opportunities.length, 1);
    assert.equal(body.opportunities[0].notice_id, "ABC123");
    assert.ok(
      f.calls[0].includes("fit_score=gte.70"),
      "min_fit reaches PostgREST"
    );
    assert.ok(f.calls[0].includes("limit=6"), "limit reaches PostgREST");
  } finally {
    f.restore();
  }
});

test("/api/govchain/stats reads exact counts from Content-Range", async () => {
  const f = stubSupabase([ROW], 42);
  try {
    const res = await get("/api/govchain/stats");
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, number>;
    assert.equal(body.opportunities_scored, 42);
    assert.equal(body.high_fit, 42);
    assert.equal(body.proposals_drafted, 42);
  } finally {
    f.restore();
  }
});

test("/opportunities renders rows server-side", async () => {
  const f = stubSupabase([ROW]);
  try {
    const res = await get("/opportunities");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Cyber support services/);
    assert.match(html, /Fit 88/);
    assert.match(html, /\/opportunities\/ABC123/);
  } finally {
    f.restore();
  }
});

test("a notice id with no row is a 404, not an empty page at 200", async () => {
  const f = stubSupabase([]);
  try {
    const res = await get("/opportunities/NOSUCHID");
    assert.equal(res.status, 404);
  } finally {
    f.restore();
  }
});

test("an unconfigured Supabase surfaces as 503, never as marketing HTML", async () => {
  const res = await get("/api/govchain/opportunities", {});
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, "supabase_not_configured");

  const page = await get("/opportunities", {});
  assert.equal(page.status, 503);
});

test("row text is escaped, so a hostile title cannot inject markup", async () => {
  const f = stubSupabase([{ ...ROW, title: "<script>alert(1)</script>" }]);
  try {
    const html = await (await get("/opportunities")).text();
    assert.ok(
      !html.includes("<script>alert(1)</script>"),
      "title must be escaped"
    );
    assert.match(html, /&lt;script&gt;/);
  } finally {
    f.restore();
  }
});

test("a non-https sam_url is not rendered as a link", async () => {
  const f = stubSupabase([{ ...ROW, sam_url: "javascript:alert(1)" }]);
  try {
    const html = await (await get("/opportunities")).text();
    assert.ok(
      !html.includes("javascript:alert(1)"),
      "only https links are rendered"
    );
  } finally {
    f.restore();
  }
});

test("reads go through the public views, never the base tables", async () => {
  // The base tables are deny-all for anon and hold contact_email, raw and
  // recommended_action. Querying them directly is both broken (empty 200) and
  // a PII exposure if a policy were ever added to "fix" the emptiness.
  const f = stubSupabase([ROW], 7);
  try {
    await get("/api/govchain/opportunities");
    await get("/api/govchain/stats");
    assert.ok(f.calls.length > 0, "should have queried Supabase");
    for (const url of f.calls) {
      const table = new URL(url).pathname.split("/rest/v1/")[1] ?? "";
      assert.ok(
        table.startsWith("gov_opportunities_public") ||
          table.startsWith("gov_proposals_public"),
        `query hit ${table}, expected a *_public view`
      );
    }
  } finally {
    f.restore();
  }
});
