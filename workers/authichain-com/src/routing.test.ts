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
import { planPaymentLink, planUsd } from "../../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402.ts";
import worker from "./index.ts";
import { VS_PAGES } from "./vs-pages.ts";

type Env = Parameters<typeof worker.fetch>[1];

/** APP_WORKER stands in for the service binding, which local tests do not have. */
const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

async function get(path: string, env: Env = ENV) {
  return worker.fetch(
    new Request(`https://authichain.govchain.us${path}`),
    env
  );
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

test("unknown 404s still offer catalogue Payment Links", async () => {
  const res = await get("/nope-xyz123");
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.ok(
    html.includes('href="https://authichain.com/checkout/strainchain_passport"')
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.equal(html.includes('href="/api/checkout'), false);
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/checkout\/strainchain_passport"/
  );
  assert.match(html, /name="robots" content="noindex"/);
});

// RES-162 (sibling of CFA-147 in #1706): the /vs/* comparison pages and
// /mcp/install make no "certificate contract live/deployed on Polygon" claim
// and show no 0x4da4 contract address until wallet ownership is proven.
// RES-167: also no "Polygon mainnet" anchored-record card and no
// "Certificate contract on Polygon" footer. RES-209: "anchored on Polygon"
// is now cut from /vs/vechain too and banned on every /vs/* page.
test("/vs/* and /mcp/install make no Polygon contract claim (RES-162)", async () => {
  const paths = ["/vs", "/mcp/install", ...VS_PAGES.map((d) => `/vs/${d.slug}`)];
  assert.ok(paths.length > 2, "expected at least one /vs/* page");
  for (const path of paths) {
    const res = await get(path);
    assert.equal(res.status, 200, `${path} should be 200`);
    const body = await res.text();
    for (const banned of [
      /live on Polygon/i,
      /deployed on Polygon/i,
      /0x4da4/i,
      // RES-167
      /Certificate contract on Polygon/i,
      // The cut "Polygon mainnet" anchored-record showcase card.
      /class="eyebrow">\s*Polygon mainnet/i,
      // RES-172: the /mcp/install meta now uses the registry line.
      /Polygon-anchored/i,
      // RES-209
      /anchored on Polygon/i,
    ]) {
      assert.doesNotMatch(body, banned, `${path} must not contain ${banned}`);
    }
    // RES-171: the verify_record tool description and the /mcp/install
    // opening no longer name Polygon mainnet, so the bare phrase is banned
    // on /mcp/install as well as /vs/*.
    assert.doesNotMatch(body, /Polygon\s+mainnet/i, `${path} must not contain Polygon mainnet`);
  }
});

test("the apex still renders the homepage", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /name="email"/);
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
  assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/strainchain_passport"')
  );
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /href="\/x402"/);
  assert.match(html, /href="\/trumark"/);
  assert.match(html, /href="\/made-in-america"/);
  assert.match(html, /href="\/passport"/);
  assert.doesNotMatch(html, /\/m\/mendo|Mendo/);
  assert.match(html, /href="\/partners\/brief"/);
  assert.match(html, /Start DPP checkout/);
  assert.match(html, /Signed QR seals for real products\./);
  assert.doesNotMatch(html, /Agent consensus/);
  assert.match(html, /Public certificate registry: in development\./);
  const starterFirst = planPaymentLink("starter") ?? "";
  const auditLater = planPaymentLink("dpp_readiness") ?? "";
  assert.ok(starterFirst.length > 0 && auditLater.length > 0);
  assert.ok(
    html.indexOf(starterFirst) < html.indexOf(auditLater),
    "the $29 link has to appear before the $299 audit"
  );
  assert.match(html, /Buy a QRON Starter Pack — \$29/);
  // Held pending decision: the $29 banner stays as it is.
  assert.match(html, /The first checkout is the \$29 signed pack\./);
  assert.match(html, /name="email"/);
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
  assert.match(html, /The authentic agentic economy/);
  // AE-20261002-CFD-09: no Apollo visitor tracker anywhere on authichain.com.
  assert.ok(!html.includes("6ab2b3b358b37e000c06b0fa"));
  assert.ok(!html.includes("tracker.iife.js"));
  assert.ok(!html.toLowerCase().includes("apollo"));
  assert.ok(
    !(res.headers.get("content-security-policy") ?? "").includes("apollo")
  );
  // The homepage Made in America card rewrite (same wrapper) still applies.
  assert.match(html, /https:\/\/authichain\.com\/checkout\/musa_claim_file/);
  const faqStart = html.indexOf('"@type":"FAQPage"');
  assert.ok(faqStart > 0, "homepage JSON-LD should include FAQPage");
  const faqSlice = html.slice(faqStart, faqStart + 4000);
  const dppPay = planPaymentLink("dpp_readiness") ?? "";
  const passportPay = planPaymentLink("strainchain_passport") ?? "";
  const starterPay = planPaymentLink("starter") ?? "";
  const creatorPay = planPaymentLink("creator") ?? "";
  assert.ok(faqSlice.includes(dppPay));
  assert.ok(faqSlice.includes(passportPay));
  assert.ok(faqSlice.includes(starterPay));
  assert.ok(faqSlice.includes(creatorPay));
  const orgStart = html.indexOf('"@type":"Organization"');
  assert.ok(orgStart > 0, "homepage JSON-LD should include Organization");
  const orgSlice = html.slice(orgStart, html.indexOf("</script>", orgStart));
  assert.equal(orgSlice.includes(`"url":"${dppPay}"`), true);
  assert.equal(orgSlice.includes(`"url":"${passportPay}"`), true);
  assert.equal(orgSlice.includes(`"url":"${starterPay}"`), true);
  assert.equal(orgSlice.includes(`"url":"${creatorPay}"`), true);
  assert.equal(orgSlice.includes("/api/checkout"), false);
  assert.match(html, /href="\/authentic-agentic-economy"/);
  assert.doesNotMatch(html, /\$QRON token|Speculative utility/);
  assert.doesNotMatch(html, /GET \/api\/checkout/);
  assert.doesNotMatch(
    html,
    /used for TrueMark minting fees and authentication activity/
  );
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
  // Retired AuthiChain Starter $299/mo link belonged to no live Stripe account.
  assert.doesNotMatch(html, /AuthiChain Starter/);
  assert.doesNotMatch(html, /28E8wP0EVf7M6mefTS1Nu1p/);
  assert.match(html, /\$299/);
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
  assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  // Theater is unlisted since the #1234 catalog freeze.
  assert.equal(html.includes("checkout/theater_1"), false);
  assert.equal(html.includes("checkout/theater_3"), false);
  assert.match(html, /href="\/x402"/);
  assert.doesNotMatch(html, /GET \/api\/checkout/);
});

test("/contact is a real page, not the homepage", async () => {
  const res = await get("/contact");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /hello@authichain\.com/);
  assert.match(html, /<title>Contact AuthiChain<\/title>/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
});

test("/privacy and /terms are the operator's pages, not a placeholder", async () => {
  for (const [path, title, canonical] of [
    ["/privacy", "Privacy Policy — AuthiChain", "https://authichain.com/privacy"],
    ["/privacy/", "Privacy Policy — AuthiChain", "https://authichain.com/privacy"],
    ["/terms", "Terms of Service — AuthiChain", "https://authichain.com/terms"],
    ["/terms/", "Terms of Service — AuthiChain", "https://authichain.com/terms"],
  ] as const) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/, path);
    const html = await res.text();
    assert.match(html, new RegExp(`<title>${title}</title>`), path);
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}">`), path);
    assert.match(html, /Zachary Kietzman/, path);
    assert.match(html, /sole proprietor/, path);
    assert.match(html, /hello@authichain\.com/, path);
    assert.match(html, /support@authichain\.com/, path);
    assert.match(html, /not affiliated with, endorsed by, or acting on behalf of any government agency/, path);
    assert.match(html, /Effective 5 October 2026/, path);
    assert.doesNotMatch(html, /privacy@authichain\.com/, path);
    assert.doesNotMatch(html, /legal@authichain\.com/, path);
    assert.doesNotMatch(html, /Vercel/, path);
    assert.doesNotMatch(html, /AuthiChain Inc/i, path);
    assert.doesNotMatch(html, /Bitcoin/, path);
  }

  const privacy = await (await get("/privacy")).text();
  assert.match(privacy, /We do not sell personal information/);
  assert.match(privacy, /Stripe/);
  assert.match(privacy, /do not receive your card number/);
  assert.match(privacy, /0\.05 USDC/);
  assert.match(privacy, /\$QRON token is not a way to pay/);
  assert.match(privacy, /simulated/);

  const terms = await (await get("/terms")).text();
  assert.match(terms, /not a GS1 Conformant Resolver/);
  assert.match(terms, /not a legal opinion/);
  assert.match(terms, /0\.05 USDC/);
  assert.match(terms, /\$QRON token is not accepted as payment/);
  assert.match(terms, /State of Michigan/);
  assert.match(terms, /href="\/privacy"/);

  for (const [from, to] of [
    ["/privacy-policy", "/privacy"],
    ["/legal/privacy", "/privacy"],
    ["/terms-of-service", "/terms"],
    ["/tos", "/terms"],
    ["/legal/terms", "/terms"],
  ] as const) {
    const res = await get(from);
    assert.equal(res.status, 301, from);
    assert.equal(
      new URL(res.headers.get("location") ?? "", "https://authichain.com").pathname,
      to,
      from
    );
  }

  const confirm = await get("/checkout/dpp_readiness");
  assert.equal(confirm.status, 200);
  const confirmHtml = await confirm.text();
  assert.match(confirmHtml, /By continuing you agree to the <a href="\/terms">Terms of Service<\/a>/);
  assert.match(confirmHtml, /href="\/privacy"/);
  assert.match(confirmHtml, /No newsletter/);
});

test("/docs serves the wave-1 pages and leaves /docs/x402 alone", async () => {
  const hub = await get("/docs");
  assert.equal(hub.status, 200);
  const hubHtml = await hub.text();
  assert.match(hubHtml, /AuthiChain Docs/);
  assert.match(hubHtml, /not a GS1 Conformant Resolver/);
  assert.doesNotMatch(hubHtml, /Bitcoin L1/);

  for (const path of [
    "/docs/gs1-digital-link",
    "/docs/verification",
    "/docs/dpp-architecture",
    "/docs/examples",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/, path);
  }

  const alias = await get("/docs/resolver");
  assert.equal(alias.status, 301);
  assert.equal(
    new URL(alias.headers.get("location") ?? "", "https://authichain.com")
      .pathname,
    "/docs/gs1-digital-link"
  );

  const protocol = await get("/docs/protocol");
  assert.equal(protocol.status, 301);
  assert.equal(
    new URL(protocol.headers.get("location") ?? "", "https://authichain.com")
      .pathname,
    "/protocol"
  );

  for (const path of [
    "/onboard",
    "/verify",
    "/pricing",
    "/checkout/dpp_readiness",
  ]) {
    const res = await get(path);
    const body = await res.text();
    assert.doesNotMatch(
      body,
      /AuthiChain Docs — verification infrastructure/,
      path
    );
    assert.ok(
      res.status === 200 || res.status === 302 || res.status === 303,
      `${path} ${res.status}`
    );
  }
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
    assert.ok(html.includes(X402_PUBLISHED_PAY_TO), path);
    assert.match(html, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
    assert.match(html, /\$0\.05/);
    const urls = (html.match(/https:\/\/[^\s"'<>]+/g) ?? []).map(
      u => new URL(u)
    );
    for (const p of ["/api/x402/health", "/api/x402/catalog"]) {
      assert.ok(
        urls.some(u => u.hostname === "authichain.com" && u.pathname === p),
        `${path} ${p}`
      );
    }
    assert.match(html, /curl -sS https:\/\/authichain\.com\/api\/x402\/health/);
    assert.match(
      html,
      /curl -sS https:\/\/authichain\.com\/api\/x402\/catalog/
    );
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
    const farmPay = planPaymentLink("strainchain_farm") ?? "";
    assert.ok(farmPay, `${path} Farm Payment Link must exist in plans.ts`);
    assert.equal(new URL(farmPay).hostname, "authichain.com");
    assert.equal(
      html.includes(`href="${farmPay}"`),
      false,
      `${path} must not list Farm`
    );
    assert.doesNotMatch(html, /href=["']\/api\/checkout/);
    assert.doesNotMatch(html, /GET \/api\/checkout/);
  }
});

test("homepage and /dpp link to /docs and /x402", async () => {
  const home = await (await get("/")).text();
  assert.match(home, /href="\/docs"/);
  assert.match(home, /href="\/x402"/);
  const dpp = await (await get("/dpp")).text();
  assert.match(dpp, /href="\/docs"/);
  assert.match(dpp, /href="\/x402"/);
  assert.match(dpp, /href="\/battery-passport"/);
  assert.match(dpp, /name="email"/);
  assert.match(
    dpp,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
  assert.match(dpp, /id="dpp-cancelled-banner"/);
});

test("/authentic-agentic-economy is a real positioning page", async () => {
  for (const path of [
    "/authentic-agentic-economy",
    "/authentic-agentic-economy/",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/, path);
    const html = await res.text();
    assert.match(
      html,
      /<title>The authentic agentic economy — AuthiChain<\/title>/
    );
    assert.match(
      html,
      /Agents can pay\. They still need to know if it is real\./
    );
    assert.match(
      html,
      /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
    );
    assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
    assert.match(html, /href="\/x402"/);
    assert.doesNotMatch(html, /GET \/api\/checkout/);
    assert.match(html, /arxiv\.org\/abs\/2602\.14219/);
    assert.ok(
      !html.toLowerCase().includes("facilitator.payai"),
      `${path} must not publish the facilitator URL`
    );
  }
  assert.equal((await get("/agentic-economy")).status, 404);
});

test("every comparison page renders, including the restored pilot pages", async () => {
  for (const slug of [
    "scantrust",
    "circularise",
    "vechain",
    "everledger",
    "strainsecure",
  ]) {
    const res = await get(`/vs/${slug}`);
    assert.equal(res.status, 200, `/vs/${slug} should render`);
    const html = await res.text();
    assert.match(html, /Head-to-Head Comparison/);
    assert.doesNotMatch(html, /\$299|\$49|Bitcoin|Transparent public pricing/);
  }
  const scantrust = await (await get("/vs/scantrust")).text();
  const dppPay = planPaymentLink("dpp_readiness") ?? "";
  assert.ok(scantrust.includes(`href="${dppPay}"`));
  assert.doesNotMatch(scantrust, /Start Free Trial/);
  assert.doesNotMatch(scantrust, /can be altered or lost|hides pricing/);
  for (const slug of ["everledger", "strainsecure"]) {
    const html = await (await get(`/vs/${slug}`)).text();
    assert.ok(
      html.includes(`href="/onboard?ref=vs-${slug}"`),
      `/vs/${slug} asks for a pilot`
    );
    assert.ok(
      html.includes('href="/verify"'),
      `/vs/${slug} links the verifier`
    );
    if (dppPay)
      assert.ok(
        !html.includes(dppPay),
        `/vs/${slug} must not carry the DPP checkout`
      );
    assert.doesNotMatch(
      html,
      /Start Free Trial|\bcertified\b|METRC (?:sync|integration) (?:is )?live/i
    );
  }
});

test("the /vs index lists every comparison", async () => {
  const html = await (await get("/vs")).text();
  for (const name of [
    "Scantrust",
    "Circularise",
    "VeChain",
    "Everledger",
    "StrainSecure",
  ]) {
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

/** Absolute URLs in a page, parsed, so tests compare hosts exactly. */
function urlsIn(html: string): URL[] {
  const out: URL[] = [];
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>()]+/g)) {
    try {
      out.push(new URL(m[0]));
    } catch {
      // not a URL
    }
  }
  return out;
}

const ANCHOR_TX =
  "0x24911473b03c19f3b1ee9b0887fd82ef648bf2c85386f9505a0336a9c1ae10b7";

test("anchor is an in-browser fingerprint that claims no anchoring", async () => {
  const res = await get("/anchor");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(!html.includes("app.authichain.com/login"));
  // The demo gateway stored nothing and wrote nothing on-chain; the page must
  // not call it or claim a certificate was anchored.
  assert.ok(!urlsIn(html).some(u => u.hostname === "api.authichain.com"));
  assert.ok(
    !/Certificate Anchored|Anchoring to blockchain|permanent and publicly verifiable/.test(
      html
    )
  );
  assert.match(
    html,
    /does not store anything, issue a certificate, or write to a blockchain/
  );
  // PM-372: wallet ownership of the Polygon anchor is not proven, so the page
  // must not cite a polygonscan link or the anchor transaction.
  assert.ok(!urlsIn(html).some(u => u.hostname === "polygonscan.com"));
  assert.ok(!html.includes(ANCHOR_TX));
  assert.match(html, /Self-serve anchoring from this page is not live yet/);
});

test("a demo certificate id says it is not on record, without fetching the demo gateway", async () => {
  const html = await (await get("/cert/AC-1234ABCD")).text();
  assert.match(html, /not on record/);
  assert.match(html, /noindex/);
  assert.ok(!urlsIn(html).some(u => u.hostname === "api.authichain.com"));
});

test("DPP landing collects email before protocol checkout", async () => {
  const html = await (await get("/digital-product-passport")).text();
  const dppPay = planPaymentLink("dpp_readiness") ?? "";
  assert.match(html, /name="email"/);
  assert.match(
    html,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
  assert.match(html, /id="dpp-cancelled-banner"/);
  assert.match(html, /params.get\('visit_id'\)/);
  assert.doesNotMatch(html, /href="\/protocol\/checkout\/dpp"/);
  assert.ok(html.includes(`id="nav-dpp-cta" href="${dppPay}"`));
  assert.ok(html.includes(`href="${dppPay}"`));
  assert.equal(
    html.includes("nav.setAttribute('href', '/protocol/checkout/dpp"),
    false
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.ok(!html.includes('href="/authenticate"'));
});

test("/dapp redirects to /dashboard (estate CTA)", async () => {
  const res = await get("/dapp");
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get("location"),
    "https://authichain.govchain.us/dashboard"
  );
});

test("GET /api/x402/listing and /api/x402/growth are answered here", async () => {
  const listing = await get("/api/x402/listing");
  assert.equal(listing.status, 200);
  const listingBody = (await listing.json()) as { protocol?: string; listing?: string };
  assert.equal(listingBody.protocol, "x402");
  assert.match(listingBody.listing ?? "", /\/api\/x402\/listing$/);

  const growth = await get("/api/x402/growth");
  assert.equal(growth.status, 200);
  const growthBody = (await growth.json()) as { listing?: string };
  assert.match(growthBody.listing ?? "", /\/api\/x402\/listing$/);
});

test("GET /api/x402, /health, and /api/v1/agent-verify are answered here", async () => {
  for (const path of [
    "/api/x402",
    "/api/x402/health",
    "/api/v1/agent-verify",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const body = (await res.json()) as { status: string; catalog?: string };
    assert.equal(body.status, "not_configured", path);
    assert.equal(body.catalog, "/api/x402/catalog", path);
  }
});

test("GET /.well-known/402index-verify.txt is the 402 Index hash and nothing else", async () => {
  const res = await get("/.well-known/402index-verify.txt");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/plain/);
  const text = await res.text();
  assert.equal(
    text,
    "423fe4bfe20daf3616465b6f496a3a06e2b03d590e77511d1782bf310b7cb2af"
  );
  assert.equal(text.length, 64);
  const head = await worker.fetch(
    new Request(
      "https://authichain.govchain.us/.well-known/402index-verify.txt",
      {
        method: "HEAD",
      }
    ),
    ENV
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const posted = await worker.fetch(
    new Request(
      "https://authichain.govchain.us/.well-known/402index-verify.txt",
      {
        method: "POST",
      }
    ),
    ENV
  );
  assert.equal(posted.status, 404);
  const www = await worker.fetch(
    new Request("https://www.authichain.com/.well-known/402index-verify.txt"),
    ENV
  );
  assert.equal(www.status, 301);
  assert.equal(
    www.headers.get("location"),
    "https://authichain.com/.well-known/402index-verify.txt"
  );
});

test("/llms.txt points agents at Payment Links and unpaid POST x402", async () => {
  for (const path of ["/llms.txt", "/.well-known/llms.txt"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/plain/, path);
    const text = await res.text();
    assert.match(text, /POST https:\/\/authichain\.com\/api\/x402/);
    assert.match(text, /18 February 2027/);
    assert.match(text, /battery-passport/);
    assert.ok(text.includes(planPaymentLink("dpp_readiness") ?? ""));
    assert.ok(text.includes(planPaymentLink("strainchain_passport") ?? ""));
    assert.doesNotMatch(text, /GET \/api\/checkout/);
  }
});

test("/mcp and /api/mcp discovery says verify is free, with no Payment Links or x402 price", async () => {
  for (const path of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const body = (await res.json()) as {
      protocol: string;
      pay: { x402: string };
      pricing: {
        verify: { price: string; mcpTool: string };
        paidPlans: { status: string };
        humanCheckout?: unknown;
      };
    };
    assert.equal(body.protocol, "mcp", path);
    assert.equal(body.pay.x402, "POST https://authichain.com/api/x402", path);
    assert.equal(body.pricing.verify.price, "free", path);
    assert.equal(body.pricing.verify.mcpTool, "verify_record", path);
    assert.equal(body.pricing.paidPlans.status, "on_hold", path);
    assert.equal(body.pricing.humanCheckout, undefined, path);
    const text = JSON.stringify(body);
    assert.equal(text.includes("$0.05"), false, path);
    for (const plan of [
      "dpp_readiness",
      "strainchain_passport",
      "strainchain_farm",
    ] as const) {
      const link = planPaymentLink(plan);
      if (link) assert.equal(text.includes(link), false, `${path} ${plan}`);
    }
    assert.equal(text.includes("/api/checkout"), false, path);
  }
});

test("GET /api/x402/catalog and /.well-known/x402.json are answered here", async () => {
  for (const path of ["/api/x402/catalog", "/.well-known/x402.json"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const body = (await res.json()) as {
      protocol: string;
      catalog: string;
      health: string;
      humanCheckout?: { farmPaymentLink?: string; farmUsd?: number };
    };
    assert.equal(body.protocol, "x402", path);
    assert.equal(body.catalog, "/api/x402/catalog", path);
    assert.equal(body.health, "/api/x402/health", path);
    assert.equal(body.humanCheckout?.farmPaymentLink, undefined, path);
    assert.equal(
      body.humanCheckout?.farmUsd,
      planUsd("strainchain_farm"),
      path
    );
  }
});

test("GET /.well-known/x402 is the x402scan fan-out, not the catalog", async () => {
  const res = await get("/.well-known/x402");
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    version: number;
    resources: string[];
    protocol?: string;
  };
  assert.equal(body.version, 1);
  assert.deepEqual(body.resources, ["https://authichain.com/api/x402"]);
  assert.equal(body.protocol, undefined);
});

test("GET /openapi.json declares x-payment-info for unpaid POST /api/x402", async () => {
  const res = await get("/openapi.json");
  assert.equal(res.status, 200);
  const spec = (await res.json()) as {
    openapi: string;
    paths: {
      "/api/x402": {
        post: {
          "x-payment-info": { protocols: string[]; price: { amount: string } };
          responses: { "402": unknown };
        };
      };
    };
  };
  assert.equal(spec.openapi, "3.1.0");
  assert.deepEqual(spec.paths["/api/x402"].post["x-payment-info"].protocols, [
    "x402",
  ]);
  assert.ok(spec.paths["/api/x402"].post.responses["402"]);
  assert.equal(JSON.stringify(spec).includes("/api/checkout"), false);
  assert.match(JSON.stringify(spec), /\/battery-passport/);
  assert.match(JSON.stringify(spec), /18 February 2027/);
  assert.match(JSON.stringify(spec), /LMT/);
});

test("other /api paths still proxy to the app", async () => {
  const res = await get("/api/automation/cron");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "app");
});

test("GET /api/checkout/* (with or without email) bounces to the confirm page, not APP_WORKER", async () => {
  const dpp = await get("/api/checkout/dpp?visit_id=dpp_live_anon");
  assert.equal(dpp.status, 303);
  assert.equal(
    dpp.headers.get("location"),
    "https://authichain.com/checkout/dpp_readiness?visit_id=dpp_live_anon"
  );
  const withEmail = await get("/api/checkout/dpp?email=ops%40brand.com");
  assert.equal(withEmail.status, 303);
  assert.equal(
    withEmail.headers.get("location"),
    "https://authichain.com/checkout/dpp_readiness?email=ops%40brand.com"
  );
  const passport = await get("/api/checkout/plan/strainchain_passport");
  assert.equal(passport.status, 303);
  assert.equal(
    passport.headers.get("location"),
    "https://authichain.com/checkout/strainchain_passport"
  );
  const head = await worker.fetch(
    new Request("https://authichain.com/api/checkout/dpp", { method: "HEAD" }),
    ENV
  );
  assert.equal(head.status, 204);
});

test("/demo sends buyers to /pricing, not the legacy SPA /subscriptions catalogue", async () => {
  const res = await get("/demo");
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get("location"),
    "https://authichain.govchain.us/pricing"
  );
});

test("/demo/strainchain lands on the TruMark money surface", async () => {
  const res = await get("/demo/strainchain");
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get("location"),
    "https://authichain.govchain.us/trumark"
  );
});

test("/gov-gift and /apex-packet send APEX to the GovChain packet", async () => {
  for (const path of ["/gov-gift", "/apex-packet"]) {
    const res = await get(path);
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get("location"), "https://govchain.us/gift");
  }
});

test("/partners lands on the Made in America money surface", async () => {
  const res = await get("/partners");
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get("location"),
    "https://authichain.govchain.us/made-in-america"
  );
});

test("/gov-gift and /apex-packet send APEX to the GovChain packet", async () => {
  for (const path of ["/gov-gift", "/apex-packet"]) {
    const res = await get(path);
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get("location"), "https://govchain.us/gift");
  }
});

test("/telegram and /miniapp serve the Passport Mini App", async () => {
  for (const path of ["/telegram", "/telegram/", "/miniapp", "/miniapp/"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /<title>StrainChain Passport \| AuthiChain<\/title>/);
    assert.match(
      html,
      /action="https:\/\/authichain\.com\/checkout\/strainchain_passport"/
    );
    assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
    assert.match(html, /Publish Passport — \$49/);
    assert.match(html, /telegram\.org\/js\/telegram-web-app\.js/);
    assert.doesNotMatch(html, /calendly/i);
    assert.doesNotMatch(html, /AuthiChain Inc/i);
    assert.doesNotMatch(html, /Series A/i);
    assert.match(
      res.headers.get("content-security-policy") ?? "",
      /telegram\.org/
    );
    assert.equal(res.headers.get("x-frame-options"), null);
  }
});

test("/api/telegram is still proxied to the app, not the Mini App", async () => {
  const res = await get("/api/telegram");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "app");
});

test("retired Mendo microsite no longer serves the breeder's page", async () => {
  // The breeder declined on 2026-09-21, so /m/mendo, its aliases and its
  // hostnames must not render their library or campaign copy.
  for (const path of ["/m/mendo", "/m/realthcv", "/m/lt-63"]) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    const html = await res.text();
    assert.doesNotMatch(html, /RealTHCV|Mendo Love Farms|LT-63/, path);
  }

  const host = await worker.fetch(
    new Request("https://mendo.authichain.com/", {
      headers: { host: "mendo.authichain.com" },
    }),
    ENV
  );
  assert.doesNotMatch(await host.text(), /RealTHCV|LT-63/);

  const genetics = await get("/genetics/mendo-love-farms");
  assert.equal(genetics.status, 404);
});

test("TruMark and Made in America pages are live with checkout CTAs", async () => {
  const trumark = await get("/trumark");
  assert.equal(trumark.status, 200);
  const trumarkHtml = await trumark.text();
  assert.match(
    trumarkHtml,
    /action="https:\/\/authichain\.com\/checkout\/strainchain_passport"/
  );
  assert.match(
    trumarkHtml,
    /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
  );
  assert.doesNotMatch(trumarkHtml, /href="\/api\/checkout/);
  assert.doesNotMatch(trumarkHtml, /calendly/i);
  assert.doesNotMatch(trumarkHtml, /schedule a (call|demo)/i);

  for (const path of ["/made-in-america", "/partners/brief", "/ftc-shield"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(
      html,
      /action="https:\/\/authichain\.com\/checkout\/musa_claim_file"/,
      path
    );
    assert.doesNotMatch(html, /href="\/api\/checkout/, path);
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

test("committed /p SEO hubs are served here, not a product-not-found proxy", async () => {
  for (const path of [
    "/p/battery-passport-readiness-assessment-cost",
    "/p/verify-a-product-record-offline-without-a-vendor-account",
    "/p/battery-passport-readiness-assessment-cost/",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.notEqual(html, "app", path);
    assert.match(html, /<h1>/, path);
    assert.doesNotMatch(html, /Product Not Found/, path);
  }
  const cost = await (await get("/p/battery-passport-readiness-assessment-cost")).text();
  assert.match(cost, /Battery Passport Readiness Assessment Cost/);
  assert.match(cost, /not a certification or legal opinion/);
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

test("hung APP_WORKER /p lookup 404s with Payment Links instead of hanging", async () => {
  const env = {
    APP_WORKER_TIMEOUT_MS: "40",
    APP_WORKER: { fetch: () => new Promise(() => {}) },
  } as unknown as Env;
  const res = await get("/p/not-a-real-serial", env);
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /No passport at this URL/);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/strainchain_passport"')
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.equal(html.includes('href="/api/checkout'), false);
  assert.match(html, /name="robots" content="noindex"/);
});

test("hung APP_WORKER /verify lookup 404s with HTML instead of throwing (1101)", async () => {
  const env = {
    APP_WORKER_TIMEOUT_MS: "40",
    APP_WORKER: { fetch: () => new Promise(() => {}) },
  } as unknown as Env;
  for (const path of ["/verify?id=test123", "/verify/CERT-001"]) {
    const res = await get(path, env);
    assert.equal(res.status, 404);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const html = await res.text();
    assert.match(html, /No record found/);
    assert.match(html, /name="robots" content="noindex"/);
    assert.equal(/on-chain|blockchain|polygon/i.test(html), false);
  }
});

test("stale APP_WORKER checkout anchors become catalogue Payment Links", async () => {
  const dpp = planPaymentLink("dpp_readiness") ?? "";
  const passport = planPaymentLink("strainchain_passport") ?? "";
  const env = {
    APP_WORKER: {
      fetch: async () =>
        new Response(
          '<a href="/api/checkout/dpp">DPP</a>' +
            '<a href="https://authichain.govchain.us/api/checkout/plan/strainchain_passport">Passport</a>' +
            '<a href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y">Raw</a>' +
            '<form action="/api/checkout/dpp"><input name="email"></form>',
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=UTF-8" },
          }
        ),
    },
  } as unknown as Env;
  // Known /p/<slug> hubs are rendered on this worker, so the rewrite only
  // runs for a serial that still proxies and for /landing/*.
  for (const path of [
    "/p/CERT-001",
    "/landing/authichain",
  ]) {
    const html = await (await get(path, env)).text();
    assert.ok(html.includes(`href="${dpp}"`), path);
    assert.ok(html.includes(`href="${passport}"`), path);
    assert.equal(html.includes('href="/api/checkout/dpp"'), false, path);
    const linkHosts = [
      ...html.matchAll(/(?:href|action)="(https?:\/\/[^"]+)"/g),
    ].map(m => new URL(m[1].replace(/&amp;/g, "&")).hostname);
    assert.equal(
      linkHosts.some(h => h === "buy.stripe.com"),
      false,
      path
    );
    assert.ok(html.includes('action="/api/checkout/dpp"'), path);
  }
});

test("seed SEO canonicals 301 to /p/<slug>, except authentic-agentic-economy", async () => {
  const res = await get("/what-is-a-digital-product-passport");
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://authichain.govchain.us/p/what-is-a-digital-product-passport"
  );
  const live = await get("/authentic-agentic-economy");
  assert.equal(live.status, 200);
  assert.match(await live.text(), /Authentic Agentic Economy|agentic economy/i);
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
  assert.equal(
    xml.split("<loc>https://authichain.com/privacy</loc>").length - 1,
    1
  );
  assert.equal(
    xml.split("<loc>https://authichain.com/terms</loc>").length - 1,
    1
  );
  assert.equal(
    xml.split("<loc>https://authichain.com/telegram</loc>").length - 1,
    1,
    "canonical Mini App loc once — not also via micrositeSitemapUrls"
  );
  assert.ok(
    !xml.includes("<loc>https://authichain.com/miniapp</loc>"),
    "/miniapp is an alias; sitemap lists /telegram only"
  );
  assert.ok(xml.includes("<loc>https://authichain.com/pricing</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/onboard</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/dpp</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/genetics</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/passport</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/trumark</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/made-in-america</loc>"));
  assert.ok(!xml.includes("mendo"));
  assert.ok(xml.includes("<loc>https://authichain.com/m/trumark</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/m/musa</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/m/strainchain</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/m/bat-2026-001</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/partners/brief</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/verify</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/x402</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/.well-known/x402</loc>"));
  assert.ok(
    xml.includes("<loc>https://authichain.com/blog/eu-dpp-manufacturer</loc>")
  );
  assert.ok(
    xml.includes(
      "<loc>https://authichain.com/p/battery-passport-qr-code-requirements</loc>"
    )
  );
  assert.ok(
    xml.includes(
      "<loc>https://authichain.com/p/eu-digital-product-passport-batteries</loc>"
    )
  );
  assert.ok(
    xml.includes(
      "<loc>https://authichain.com/p/cannabis-coa-verification-blockchain</loc>"
    )
  );
  assert.ok(
    xml.includes("<loc>https://authichain.com/authentic-agentic-economy</loc>")
  );
  assert.ok(xml.includes("<loc>https://authichain.com/llms.txt</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/mcp</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/openapi.json</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/vs/everledger</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.com/vs/strainsecure</loc>"));
});

test("EU DPP manufacturer article is a public page with live checkout CTA", async () => {
  for (const path of [
    "/blog/eu-dpp-manufacturer",
    "/blog/eu-dpp-manufacturer/",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(
      html,
      /Why AuthiChain is built for the next generation of product trust/
    );
    assert.match(
      html,
      /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/
    );
    assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
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
  const robotsText = await robots.text();
  assert.match(robotsText, /Sitemap: https:\/\/authichain\.com\/sitemap.xml/);
  assert.ok(robotsText.includes("https://authichain.com/llms.txt"));
  assert.ok(robotsText.includes("https://authichain.com/openapi.json"));
  assert.ok(robotsText.includes("https://authichain.com/.well-known/x402"));
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

test("api-v1 endpoints use API_WORKER while unrelated /api paths keep APP_WORKER", async () => {
  const seen: string[] = [];
  const api = {
    fetch: async (r: Request) => {
      seen.push("api:" + new URL(r.url).pathname);
      return new Response("api", { status: 200 });
    },
  };
  const app = {
    fetch: async (r: Request) => {
      seen.push("app:" + new URL(r.url).pathname);
      return new Response("app", { status: 200 });
    },
  };
  const env = { API_WORKER: api, APP_WORKER: app } as unknown as Env;

  const jwks = await worker.fetch(
    new Request("https://authichain.com/api/v1/.well-known/jwks.json"),
    env
  );
  assert.equal(jwks.status, 200);
  assert.equal(await jwks.text(), "api");

  const leads = await worker.fetch(
    new Request("https://authichain.com/api/leads/capture", {
      method: "POST",
      body: "{}",
    }),
    env
  );
  assert.equal(leads.status, 200);
  assert.equal(await leads.text(), "app");

  assert.deepEqual(seen, [
    "api:/api/v1/.well-known/jwks.json",
    "app:/api/leads/capture",
  ]);
});

test("/protocol links the anchored demonstration record and the MCP tool", async () => {
  const html = await (await get("/protocol")).text();
  // Parse links and compare exactly (CodeQL flags URL-shaped regexes).
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(
    m => new URL(m[1], "https://authichain.com")
  );
  // PM-374: wallet ownership of the anchor is not proven, so /protocol must
  // not link the anchor transaction on polygonscan.
  assert.ok(!links.some(u => u.hostname === "polygonscan.com"));
  assert.ok(
    links.some(
      u =>
        u.hostname === "authichain.com" &&
        u.pathname === "/api/verify" &&
        u.searchParams.get("id") === "polygon-anchor-1"
    )
  );
  assert.match(html, /verify_record/);
});

// CFA-147 / PM-349 / PM-393: no "certificate contract live/deployed on Polygon"
// claim and no 0x4da4 contract link until wallet ownership is proven.
test("home, /anchor, /dpp and the OG image make no Polygon contract claim (CFA-147)", async () => {
  for (const path of ["/", "/anchor", "/dpp", "/digital-product-passport", "/og-image.svg"]) {
    const res = await get(path);
    assert.equal(res.status, 200, `${path} should be 200`);
    const body = await res.text();
    for (const banned of [/live on Polygon/i, /deployed on Polygon/i, /0x4da4/i]) {
      assert.doesNotMatch(body, banned, `${path} must not contain ${banned}`);
    }
  }
});

test("vs pages and the scantrust page carry no unbacked 'Tamper-Proof by Design' claim", async () => {
  const { readFileSync } = await import("node:fs");
  const { renderVsPage, renderVsIndex } = await import("./vs-pages.ts");
  const banned = /Tamper-Proof by Design/i;
  assert.doesNotMatch(renderVsIndex(), banned);
  for (const def of VS_PAGES) {
    assert.doesNotMatch(renderVsPage(def), banned, `/vs/${def.slug}`);
    assert.doesNotMatch(JSON.stringify(def), banned, `/vs/${def.slug} data`);
  }
  const scantrust = readFileSync(new URL("../../../src/app/vs/scantrust/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(scantrust, banned, "src/app/vs/scantrust/page.tsx");
});
