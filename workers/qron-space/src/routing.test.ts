/**
 * qron.space path routing.
 *
 * The fault being guarded: every URL on this domain fell through to the same
 * marketing page at HTTP 200, so unknown paths were indistinguishable from real
 * ones and the sitemap's five #fragment entries looked like five pages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402.ts";
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

/** Parse sitemap <loc> values as https URLs — do not concatenate schemes. */
function sitemapHttpsLocs(xml: string): URL[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => {
    const url = new URL(match[1]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "qron.space");
    return url;
  });
}

/** Parse robots `# https://…` comment URLs — do not substring-match hosts. */
function robotsHttpsCommentPaths(text: string): string[] {
  return [...text.matchAll(/^# (https:\/\/\S+)/gm)].map(match => {
    const url = new URL(match[1]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "qron.space");
    return url.pathname;
  });
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
    assert.match(html, /href="\/pricing"/);
    assert.match(html, /\$29/);
    assert.match(html, /\$99/);
    assert.match(html, /\$299/);
    assert.doesNotMatch(html, /\$2,990/);
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
  const paths = sitemapHttpsLocs(xml).map(url => url.pathname);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/pricing"));
  assert.ok(paths.includes("/generate"));
  assert.ok(paths.includes("/llms.txt"));
  assert.ok(paths.includes("/openapi.json"));
  assert.ok(paths.includes("/api/x402"));
  assert.equal(xml.includes("/api/checkout"), false);
  for (const path of ["/llms.txt", "/openapi.json", "/api/x402"]) {
    const res = await get(path);
    assert.ok(
      res.status >= 200 && res.status < 400,
      `${path} answered ${res.status}`
    );
  }
});

test("/llms.txt and /openapi.json point agents at Payment Links and unpaid POST x402", async () => {
  const llms = await get("/llms.txt");
  assert.equal(llms.status, 200);
  assert.match(llms.headers.get("content-type") ?? "", /text\/plain/);
  const text = await llms.text();
  assert.match(text, /POST https:\/\/qron\.space\/api\/x402/);
  assert.ok(text.includes(planPaymentLink("dpp_readiness") ?? ""));
  assert.ok(text.includes(planPaymentLink("strainchain_passport") ?? ""));
  assert.equal(
    `href="${planPaymentLink("strainchain_passport")}"`.startsWith(
      'href="https://buy.stripe.com'
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
  assert.deepEqual(spec.servers, [{ url: "https://qron.space" }]);
  assert.ok(spec.paths["/api/x402"].get?.responses["200"]);
  assert.deepEqual(spec.paths["/api/x402"].post["x-payment-info"].protocols, [
    "x402",
  ]);
  assert.ok(spec.paths["/api/x402"].post.responses["402"]);
  assert.equal(JSON.stringify(spec).includes("/api/checkout"), false);
});

test("unpaid POST /api/x402 is 402 v2 with published payTo; GET health is 200", async () => {
  const unpaid = await worker.fetch(
    new Request("https://qron.space/api/x402", { method: "POST" })
  );
  assert.equal(unpaid.status, 402);
  const body = (await unpaid.json()) as {
    x402Version: number;
    resource?: { url?: string };
    accepts: Array<{ payTo: string; amount?: string }>;
    extensions?: { bazaar?: unknown };
  };
  assert.equal(body.x402Version, 2);
  assert.equal(body.resource?.url, "https://qron.space/api/x402");
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

test("/pricing is a real catalogue page, not a 404", async () => {
  const res = await get("/pricing");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Pricing — QRON<\/title>/);
  assert.match(html, /\$299/);
  assert.match(html, /href="\/generate"/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="https:\/\/authichain\.com\/api\/checkout\/dpp"/);
  assert.doesNotMatch(
    html,
    /href="https:\/\/authichain\.com\/api\/checkout\/dpp"/
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/00w4gzgDT6Bg5iagXW1ND3A"')
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/7sYdR95ZfcZEcKCfTS1ND3B"')
  );
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/api\/checkout\/plan\/theater_1"/
  );
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/api\/checkout\/plan\/theater_3"/
  );
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
  assert.match(robotsText, /Sitemap: https:\/\/qron.space\/sitemap.xml/);
  const commentPaths = robotsHttpsCommentPaths(robotsText);
  assert.ok(commentPaths.includes("/llms.txt"));
  assert.ok(commentPaths.includes("/openapi.json"));
  assert.ok(commentPaths.includes("/api/x402"));
  assert.doesNotMatch(robotsText, /GET \/api\/checkout/);
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
});

test("/generate is proxied to the app, not answered with a 404", async () => {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit
  ) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("generate", { status: 200 });
  }) as typeof fetch;
  try {
    const res = await get("/generate", {
      APP_ORIGIN: "https://app.example.com",
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "qron-space-proxy");
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/generate");
  } finally {
    globalThis.fetch = real;
  }
});

test("POST /api/generate is proxied to the app, not landing HTML 404", async () => {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit
  ) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const res = await worker.fetch(
      new Request("https://qron.space/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUrl: "https://example.com",
          prompt: "neon",
        }),
      }),
      { APP_ORIGIN: "https://app.example.com" }
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "qron-space-proxy");
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/api/generate");
    assert.equal(calls[0].method, "POST");
  } finally {
    globalThis.fetch = real;
  }
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
    const res = await get("/p/ai-qr-code-art-generator", {
      APP_ORIGIN: "https://app.example.com",
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "qron-space-proxy");
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/p/ai-qr-code-art-generator");
  } finally {
    globalThis.fetch = real;
  }
});

test("seed canonicals 301 to /p/<slug>", async () => {
  const res = await get("/ai-qr-code-art-generator");
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://qron.space/p/ai-qr-code-art-generator"
  );
});

test("the 404 escapes the path, so a hostile URL cannot inject markup", async () => {
  const html = await (await get("/%3Cscript%3Ealert(1)%3C/script%3E")).text();
  assert.ok(
    !html.includes("<script>alert(1)</script>"),
    "path must be escaped"
  );
});
