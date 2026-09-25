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
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402.ts";
import worker from "./index.ts";

type Env = Parameters<typeof worker.fetch>[1];

/** APP_WORKER stands in for the service binding, which local tests do not have. */
const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

async function get(path: string, env: Env = ENV) {
  return worker.fetch(new Request(`https://authichain.govchain.us${path}`), env);
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
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/strainchain_passport"/);
  assert.match(html, /name="robots" content="noindex"/);
});

test("the apex still renders the homepage", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
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
  assert.match(html, /href="\/m\/mendo"/);
  assert.match(html, /href="\/partners\/brief"/);
  assert.match(html, /Start DPP checkout/);
  assert.match(html, /Issue seals\. Bind products\. Verify anywhere\./);
  const starterFirst = planPaymentLink("starter") ?? "";
  const auditLater = planPaymentLink("dpp_readiness") ?? "";
  assert.ok(starterFirst.length > 0 && auditLater.length > 0);
  assert.ok(
    html.indexOf(starterFirst) < html.indexOf(auditLater),
    "the $29 link has to appear before the $299 audit"
  );
  assert.match(html, /Buy the \$29 signed pack/);
  assert.match(html, /name="email"/);
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.match(html, /The authentic agentic economy/);
  assert.ok(html.includes("6ab2b3b358b37e000c06b0fa"));
  assert.ok(html.includes("tracker.iife.js"));
  assert.ok(
    (res.headers.get("content-security-policy") ?? "").includes(
      "https://assets.apollo.io"
    )
  );
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
  assert.match(html, /not a payment rail/);
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
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.doesNotMatch(html, /href="(?:https:\/\/[^"]*)?\/api\/checkout\//);
  assert.ok(
    html.includes('href="https://authichain.com/checkout/dpp_readiness"')
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/theater_1"')
  );
  assert.ok(
    html.includes('href="https://authichain.com/checkout/theater_3"')
  );
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/theater_1"/);
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/theater_3"/);
  assert.match(html, /href="\/x402"/);
  assert.doesNotMatch(html, /GET \/api\/checkout/);
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
    assert.ok(html.includes(X402_PUBLISHED_PAY_TO), path);
    assert.match(html, /0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/);
    assert.match(html, /\$0\.05/);
    assert.match(html, /https:\/\/authichain\.govchain\.us\/api\/x402\/health/);
    assert.match(html, /https:\/\/authichain\.govchain\.us\/api\/x402\/catalog/);
    assert.match(html, /curl -sS https:\/\/authichain\.govchain\.us\/api\/x402\/health/);
    assert.match(
      html,
      /curl -sS https:\/\/authichain\.govchain\.us\/api\/x402\/catalog/
    );
    assert.match(
      html,
      /curl -sS -i -X POST https:\/\/authichain\.govchain\.us\/api\/x402/
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
    assert.ok(html.includes(`href="${farmPay}"`), `${path} must list Farm`);
    assert.doesNotMatch(html, /href=["']\/api\/checkout/);
    assert.doesNotMatch(html, /GET \/api\/checkout/);
  }
});

test("homepage and /dpp link to /x402", async () => {
  const home = await (await get("/")).text();
  assert.match(home, /href="\/x402"/);
  const dpp = await (await get("/dpp")).text();
  assert.match(dpp, /href="\/x402"/);
  assert.match(dpp, /name="email"/);
  assert.match(dpp, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
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
    assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
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

test("every comparison page renders, including the new /vs/everledger", async () => {
  for (const slug of ["scantrust", "circularise", "vechain", "everledger"]) {
    const res = await get(`/vs/${slug}`);
    assert.equal(res.status, 200, `/vs/${slug} should render`);
    assert.match(await res.text(), /Head-to-Head Comparison/);
  }
  const everledger = await (await get("/vs/everledger")).text();
  assert.match(everledger, /AuthiChain vs Everledger/);
  const dppPay = planPaymentLink("dpp_readiness") ?? "";
  assert.ok(everledger.includes(`href="${dppPay}"`));
  assert.doesNotMatch(everledger, /Start Free Trial/);
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

test("DPP landing collects email before protocol checkout", async () => {
  const html = await (await get("/digital-product-passport")).text();
  const dppPay = planPaymentLink("dpp_readiness") ?? "";
  assert.match(html, /name="email"/);
  assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
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
  assert.equal(res.headers.get("location"), "https://authichain.govchain.us/dashboard");
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
    new Request("https://authichain.govchain.us/.well-known/402index-verify.txt", {
      method: "HEAD",
    }),
    ENV
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const posted = await worker.fetch(
    new Request("https://authichain.govchain.us/.well-known/402index-verify.txt", {
      method: "POST",
    }),
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
    "https://authichain.govchain.us/.well-known/402index-verify.txt"
  );
});

test("/llms.txt points agents at Payment Links and unpaid POST x402", async () => {
  for (const path of ["/llms.txt", "/.well-known/llms.txt"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/plain/, path);
    const text = await res.text();
    assert.match(text, /POST https:\/\/authichain\.govchain\.us\/api\/x402/);
    assert.ok(text.includes(planPaymentLink("dpp_readiness") ?? ""));
    assert.ok(text.includes(planPaymentLink("strainchain_passport") ?? ""));
    assert.doesNotMatch(text, /GET \/api\/checkout/);
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
        };
      };
    };
    assert.equal(body.protocol, "mcp", path);
    assert.equal(body.pay.x402, "POST https://authichain.govchain.us/api/x402", path);
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
      new URL(body.pricing.humanCheckout.farmPaymentLink ?? "").hostname,
      "authichain.com",
      path
    );
    assert.equal(JSON.stringify(body).includes("/api/checkout"), false, path);
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
    assert.equal(
      body.humanCheckout?.farmPaymentLink,
      planPaymentLink("strainchain_farm"),
      path
    );
    assert.equal(
      new URL(body.humanCheckout?.farmPaymentLink ?? "").hostname,
      "authichain.com",
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
  assert.deepEqual(body.resources, ["https://authichain.govchain.us/api/x402"]);
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
  assert.equal(res.headers.get("location"), "https://authichain.govchain.us/pricing");
});

test("/demo/strainchain lands on the TruMark money surface", async () => {
  const res = await get("/demo/strainchain");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://authichain.govchain.us/trumark");
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
    assert.doesNotMatch(
      html,
      /href="(?:https:\/\/[^"]*)?\/api\/checkout\//
    );
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

test("money-path microsites are live with checkout CTAs", async () => {
  const mendo = await get("/m/mendo");
  assert.equal(mendo.status, 200);
  const mendoHtml = await mendo.text();
  assert.match(
    mendoHtml,
    /action="https:\/\/authichain\.com\/checkout\/strainchain_passport"/
  );
  assert.doesNotMatch(
    mendoHtml,
    /href="(?:https:\/\/[^"]*)?\/api\/checkout\//
  );
  assert.match(mendoHtml, /Passport checkout — \$49/);
  assert.match(mendoHtml, /LT-63/);
  assert.doesNotMatch(mendoHtml, /calendly/i);
  assert.doesNotMatch(mendoHtml, /book a call/i);

  const host = await worker.fetch(
    new Request("https://mendo.authichain.com/", {
      headers: { host: "mendo.authichain.com" },
    }),
    ENV
  );
  assert.equal(host.status, 200);
  assert.match(await host.text(), /RealTHCV/);
});

test("TruMark and Made in America pages are live with checkout CTAs", async () => {
  const trumark = await get("/trumark");
  assert.equal(trumark.status, 200);
  const trumarkHtml = await trumark.text();
  assert.match(
    trumarkHtml,
    /action="https:\/\/authichain\.com\/checkout\/strainchain_passport"/
  );
  assert.match(trumarkHtml, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
  assert.doesNotMatch(trumarkHtml, /href="\/api\/checkout/);
  assert.doesNotMatch(trumarkHtml, /calendly/i);
  assert.doesNotMatch(trumarkHtml, /schedule a (call|demo)/i);

  for (const path of ["/made-in-america", "/partners/brief", "/ftc-shield"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/, path);
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
  for (const path of [
    "/p/what-is-a-digital-product-passport",
    "/landing/authichain",
  ]) {
    const html = await (await get(path, env)).text();
    assert.ok(html.includes(`href="${dpp}"`), path);
    assert.ok(html.includes(`href="${passport}"`), path);
    assert.equal(html.includes('href="/api/checkout/dpp"'), false, path);
    const linkHosts = [...html.matchAll(/(?:href|action)="(https?:\/\/[^"]+)"/g)].map(
      m => new URL(m[1].replace(/&amp;/g, "&")).hostname
    );
    assert.equal(linkHosts.some(h => h === "buy.stripe.com"), false, path);
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
      !xml.includes(`<loc>https://authichain.govchain.us${gone}</loc>`),
      `${gone} should be gone`
    );
  }
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/contact</loc>"));
  assert.equal(
    xml.split("<loc>https://authichain.govchain.us/telegram</loc>").length - 1,
    1,
    "canonical Mini App loc once — not also via micrositeSitemapUrls"
  );
  assert.ok(
    !xml.includes("<loc>https://authichain.govchain.us/miniapp</loc>"),
    "/miniapp is an alias; sitemap lists /telegram only"
  );
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/pricing</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/onboard</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/dpp</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/genetics</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/passport</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/trumark</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/made-in-america</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/m/mendo</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/m/trumark</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/m/musa</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/m/strainchain</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/m/bat-2026-001</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/partners/brief</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/verify</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/x402</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/.well-known/x402</loc>"));
  assert.ok(
    xml.includes("<loc>https://authichain.govchain.us/blog/eu-dpp-manufacturer</loc>")
  );
  assert.ok(
    xml.includes(
      "<loc>https://authichain.govchain.us/p/battery-passport-qr-code-requirements</loc>"
    )
  );
  assert.ok(
    xml.includes(
      "<loc>https://authichain.govchain.us/p/eu-digital-product-passport-batteries</loc>"
    )
  );
  assert.ok(
    xml.includes(
      "<loc>https://authichain.govchain.us/p/cannabis-coa-verification-blockchain</loc>"
    )
  );
  assert.ok(
    xml.includes("<loc>https://authichain.govchain.us/authentic-agentic-economy</loc>")
  );
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/llms.txt</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/mcp</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/openapi.json</loc>"));
  assert.ok(xml.includes("<loc>https://authichain.govchain.us/vs/everledger</loc>"));
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
    assert.match(html, /action="https:\/\/authichain\.com\/checkout\/dpp_readiness"/);
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
  assert.match(robotsText, /Sitemap: https:\/\/authichain\.govchain\.us\/sitemap.xml/);
  assert.ok(robotsText.includes("https://authichain.govchain.us/llms.txt"));
  assert.ok(robotsText.includes("https://authichain.govchain.us/openapi.json"));
  assert.ok(robotsText.includes("https://authichain.govchain.us/.well-known/x402"));
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
