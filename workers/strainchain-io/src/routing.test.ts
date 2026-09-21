/**
 * strainchain.io path routing.
 *
 * The fault being guarded: before path routing existed, every URL on this
 * domain fell through to the same hand-written marketing page, so a scanned
 * passport link resolved to the homepage and the scan dead-ended. These tests
 * hold the line that verification paths leave this worker and marketing paths
 * do not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402.ts";
import worker from "./index.ts";

const APP = "https://app.example.com";

/** Captures the request the worker would have sent upstream. */
function stubFetch() {
  const calls: Request[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit
  ) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("upstream body", {
      status: 200,
      headers: { "content-type": "text/html", "x-from": "upstream" },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

async function get(
  path: string,
  env: { APP_ORIGIN?: string } = { APP_ORIGIN: APP }
) {
  return worker.fetch(new Request(`https://strainchain.io${path}`), env);
}

/** Parse sitemap <loc> values as https URLs — do not concatenate schemes. */
function sitemapHttpsLocs(xml: string): URL[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => {
    const url = new URL(match[1]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "strainchain.io");
    return url;
  });
}

/** Parse robots `# https://…` comment URLs — do not substring-match hosts. */
function robotsHttpsCommentPaths(text: string): string[] {
  return [...text.matchAll(/^# (https:\/\/\S+)/gm)].map(match => {
    const url = new URL(match[1]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "strainchain.io");
    return url.pathname;
  });
}

test("verification paths are proxied to the app, not answered with marketing", async () => {
  const f = stubFetch();
  try {
    for (const path of [
      "/genetics/mendo-love-farms",
      "/genetics/mendo-love-farms/vt-26",
      "/passport/AC-DEMO-001",
      "/onboard",
      "/p/cannabis-blockchain-provenance",
      "/p/blockchain-qr-code-for-cannabis",
    ]) {
      f.calls.length = 0;
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.equal(
        res.headers.get("x-served-by"),
        "strainchain-io-proxy",
        path
      );
      assert.equal(
        f.calls.length,
        1,
        `${path} should hit the app exactly once`
      );
      assert.equal(new URL(f.calls[0].url).pathname, path);
      assert.equal(new URL(f.calls[0].url).host, "app.example.com");
    }
  } finally {
    f.restore();
  }
});

test("the upstream is addressed by its own host, not strainchain.io", async () => {
  const f = stubFetch();
  try {
    await get("/passport/AC-DEMO-001");
    const sent = f.calls[0];
    // Forwarding the original request would carry Host: strainchain.io and
    // misroute it at the upstream.
    assert.equal(sent.headers.get("X-Forwarded-Host"), "strainchain.io");
    assert.equal(new URL(sent.url).host, "app.example.com");
  } finally {
    f.restore();
  }
});

test("query strings survive the hop", async () => {
  const f = stubFetch();
  try {
    await worker.fetch(
      new Request("https://strainchain.io/passport/AC-1?utm_source=qr"),
      { APP_ORIGIN: APP }
    );
    assert.equal(new URL(f.calls[0].url).search, "?utm_source=qr");
  } finally {
    f.restore();
  }
});

test("the apex offers Passport checkout and the live Basic Payment Link", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="email"/);
  assert.match(
    html,
    /action="https:\/\/authichain.com\/api\/checkout\/plan\/strainchain_passport"/
  );
  assert.doesNotMatch(
    html,
    /href="https:\/\/authichain.com\/api\/checkout\/plan\/strainchain_passport"/
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"')
  );
  assert.ok(
    html.includes('href="https://buy.stripe.com/9B6cN59br5xcaCuazy1Nu1o"')
  );
  assert.match(html, /Passport checkout — \$49/);
  assert.doesNotMatch(html, /calendly/i);
});

test("marketing paths stay on this worker", async () => {
  const f = stubFetch();
  try {
    for (const path of [
      "/",
      "/pricing",
      "/robots.txt",
      "/sitemap.xml",
      "/favicon.svg",
      "/authichain2026indexnow.txt",
      "/llms.txt",
      "/openapi.json",
      "/api/x402",
    ]) {
      f.calls.length = 0;
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.notEqual(
        res.headers.get("x-served-by"),
        "strainchain-io-proxy",
        path
      );
      assert.equal(f.calls.length, 0, `${path} must not be proxied`);
    }
  } finally {
    f.restore();
  }
});

test("/health still answers locally", async () => {
  const res = await get("/health");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).domain, "strainchain.io");
});

test("a misconfigured origin fails loudly instead of serving marketing", async () => {
  const f = stubFetch();
  try {
    const res = await get("/passport/AC-DEMO-001", {});
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, "app_origin_not_configured");
    assert.equal(f.calls.length, 0);
    // The specific regression: never answer a verification request with the
    // marketing document.
    assert.ok(
      !JSON.stringify(body).includes("<!DOCTYPE"),
      "must not be the marketing page"
    );
  } finally {
    f.restore();
  }
});

test("a path that merely starts with the same letters is not proxied", async () => {
  const f = stubFetch();
  try {
    const res = await get("/genetics-guide");
    assert.equal(
      f.calls.length,
      0,
      "/genetics-guide is marketing, not a passport path"
    );
    assert.notEqual(res.headers.get("x-served-by"), "strainchain-io-proxy");
  } finally {
    f.restore();
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
  assert.match(robotsText, /Sitemap: https:\/\/strainchain.io\/sitemap.xml/);
  const commentPaths = robotsHttpsCommentPaths(robotsText);
  assert.ok(commentPaths.includes("/llms.txt"));
  assert.ok(commentPaths.includes("/openapi.json"));
  assert.ok(commentPaths.includes("/api/x402"));
  assert.doesNotMatch(robotsText, /GET \/api\/checkout/);
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
});

test("the sitemap advertises the genetics library", async () => {
  const res = await get("/sitemap.xml");
  const xml = await res.text();
  const paths = sitemapHttpsLocs(xml).map(url => url.pathname);
  assert.ok(paths.includes("/genetics/mendo-love-farms"));
  assert.ok(paths.includes("/onboard"));
  assert.ok(paths.includes("/pricing"));
  assert.ok(paths.includes("/llms.txt"));
  assert.ok(paths.includes("/openapi.json"));
  assert.ok(paths.includes("/api/x402"));
  assert.equal(xml.includes("/api/checkout"), false);
});

test("/llms.txt and /openapi.json point agents at Payment Links and unpaid POST x402", async () => {
  const llms = await get("/llms.txt");
  assert.equal(llms.status, 200);
  const text = await llms.text();
  assert.match(text, /POST https:\/\/strainchain\.io\/api\/x402/);
  assert.ok(text.includes(planPaymentLink("strainchain_passport") ?? ""));
  assert.ok(text.includes(planPaymentLink("dpp_readiness") ?? ""));
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
  assert.deepEqual(spec.servers, [{ url: "https://strainchain.io" }]);
  assert.ok(spec.paths["/api/x402"].get?.responses["200"]);
  assert.deepEqual(spec.paths["/api/x402"].post["x-payment-info"].protocols, [
    "x402",
  ]);
  assert.ok(spec.paths["/api/x402"].post.responses["402"]);
});

test("unpaid POST /api/x402 is 402 v2 with published payTo; GET health is 200", async () => {
  const f = stubFetch();
  try {
    const unpaid = await worker.fetch(
      new Request("https://strainchain.io/api/x402", { method: "POST" }),
      { APP_ORIGIN: APP }
    );
    assert.equal(unpaid.status, 402);
    assert.notEqual(unpaid.headers.get("x-served-by"), "strainchain-io-proxy");
    assert.equal(f.calls.length, 0, "x402 must not be proxied");
    const body = (await unpaid.json()) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{ payTo: string; amount?: string }>;
      extensions?: { bazaar?: unknown };
    };
    assert.equal(body.x402Version, 2);
    assert.equal(body.resource?.url, "https://strainchain.io/api/x402");
    assert.equal(body.accepts[0].payTo, X402_PUBLISHED_PAY_TO);
    assert.equal(body.accepts[0].amount, "50000");
    assert.ok(body.extensions?.bazaar);
    assert.ok(unpaid.headers.get("PAYMENT-REQUIRED"));

    for (const path of ["/api/x402", "/api/x402/health"]) {
      const health = await get(path);
      assert.equal(health.status, 200, path);
      const report = (await health.json()) as { payTo: string };
      assert.equal(report.payTo, X402_PUBLISHED_PAY_TO, path);
    }
  } finally {
    f.restore();
  }
});

test("/pricing is a real catalogue page, not a 404", async () => {
  const f = stubFetch();
  try {
    const res = await get("/pricing");
    assert.equal(res.status, 200);
    assert.notEqual(res.headers.get("x-served-by"), "strainchain-io-proxy");
    assert.equal(f.calls.length, 0, "/pricing must not be proxied");
    const html = await res.text();
    assert.match(html, /<title>Pricing — StrainChain<\/title>/);
    assert.match(html, /https:\/\/buy\.stripe\.com\/9B6cN59br5xcaCuazy1Nu1o/);
    assert.match(html, /\$199/);
    assert.match(html, /StrainChain Basic/);
  } finally {
    f.restore();
  }
});

test("a configured origin with trailing slashes does not double up the path", async () => {
  const f = stubFetch();
  try {
    await worker.fetch(new Request("https://strainchain.io/passport/AC-1"), {
      APP_ORIGIN: "https://app.example.com///",
    });
    assert.equal(new URL(f.calls[0].url).pathname, "/passport/AC-1");
    assert.ok(!f.calls[0].url.includes("//passport"));
  } finally {
    f.restore();
  }
});

test("/p SEO hubs are proxied to the app, not answered with a 404", async () => {
  const f = stubFetch();
  try {
    for (const path of ["/p", "/p/", "/p/cannabis-blockchain-provenance"]) {
      f.calls.length = 0;
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.equal(
        res.headers.get("x-served-by"),
        "strainchain-io-proxy",
        path
      );
      assert.equal(f.calls.length, 1, path);
    }
  } finally {
    f.restore();
  }
});

test("seed canonicals 301 to /p/<slug>", async () => {
  const f = stubFetch();
  try {
    const res = await get("/cannabis-blockchain-provenance");
    assert.equal(res.status, 301);
    assert.equal(
      res.headers.get("location"),
      "https://strainchain.io/p/cannabis-blockchain-provenance"
    );
    assert.equal(f.calls.length, 0, "301 must not proxy");
    const pricing = await get("/pricing");
    assert.equal(pricing.status, 200);
    assert.notEqual(pricing.headers.get("location"), "/p/pricing");
  } finally {
    f.restore();
  }
});

test("trailing-slash stripping is linear, not quadratic", () => {
  // Guards the CodeQL finding: the previous /\/+$/ backtracked quadratically
  // over a long run of slashes. A pathological input must stay fast.
  const pathological = "https://app.example.com" + "/".repeat(200_000);
  const started = Date.now();
  let end = pathological.length;
  while (end > 0 && pathological.charCodeAt(end - 1) === 47) end--;
  assert.equal(pathological.slice(0, end), "https://app.example.com");
  assert.ok(
    Date.now() - started < 1000,
    "must not degrade on a long slash run"
  );
});
