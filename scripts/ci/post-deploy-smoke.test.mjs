import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SMOKE_CHECKS,
  isAccessRedirect,
  judge,
  runSmoke,
} from "./post-deploy-smoke.mjs";

function fakeFetch(map) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect });
    const r = map(url, init);
    return new Response(null, {
      status: r.status,
      headers: r.location ? { location: r.location } : {},
    });
  };
  return { impl, calls };
}

const healthy = (url, init) => {
  const c = SMOKE_CHECKS.find(
    x => x.url === url && (x.method ?? "GET") === init.method
  );
  return { status: c.expect };
};

test("covers every PM-330 item 6 surface with today's expected codes", () => {
  const byId = Object.fromEntries(SMOKE_CHECKS.map(c => [c.id, c]));
  for (const host of [
    "authichain.com",
    "qron.space",
    "govchain.us",
    "strainchain.io",
  ]) {
    assert.ok(
      SMOKE_CHECKS.some(c => c.url === `https://${host}/` && c.expect === 200),
      host
    );
  }
  assert.equal(byId.pricing.expect, 200);
  assert.equal(byId.checkout_dpp_readiness.expect, 200);
  assert.equal(byId.mcp.expect, 200);
  assert.equal(byId.x402_unpaid.expect, 402);
  assert.equal(byId.x402_unpaid.method, "POST");
  assert.equal(byId.stripe_webhook_unsigned.expect, 400);
  assert.equal(
    byId.protocol_jwks.url,
    "https://authichain.com/.well-known/jwks.json"
  );
});

test("is read-only: no GET on checkout, and nothing signed is sent", () => {
  assert.equal(
    SMOKE_CHECKS.find(c => c.id === "checkout_dpp_readiness").method,
    "HEAD"
  );
  for (const c of SMOKE_CHECKS) {
    assert.ok(!c.headers, `${c.id} sends no auth or stripe-signature headers`);
  }
});

test("all expected codes pass, redirects are not followed", async () => {
  const { impl, calls } = fakeFetch(healthy);
  const { ok } = await runSmoke({
    fetchImpl: impl,
    retries: 1,
    delayMs: 0,
    log: () => {},
  });
  assert.equal(ok, true);
  assert.ok(calls.every(c => c.redirect === "manual"));
});

test("a 302 to cloudflareaccess.com fails, without retrying", async () => {
  const { impl, calls } = fakeFetch((url, init) =>
    url === "https://authichain.com/pricing"
      ? {
          status: 302,
          location: "https://team.cloudflareaccess.com/cdn-cgi/access/login",
        }
      : healthy(url, init)
  );
  const { ok, results } = await runSmoke({
    fetchImpl: impl,
    retries: 3,
    delayMs: 0,
    log: () => {},
  });
  assert.equal(ok, false);
  assert.match(
    results.find(r => r.id === "pricing").reason,
    /Cloudflare Access/
  );
  assert.equal(
    calls.filter(c => c.url === "https://authichain.com/pricing").length,
    1
  );
});

test("an unsigned Stripe webhook that answers 200 fails the smoke", async () => {
  const { impl } = fakeFetch((url, init) =>
    url.endsWith("/api/stripe/webhook") ? { status: 200 } : healthy(url, init)
  );
  const { ok } = await runSmoke({
    fetchImpl: impl,
    retries: 1,
    delayMs: 0,
    log: () => {},
  });
  assert.equal(ok, false);
});

test("a transient 5xx is retried and can recover", async () => {
  let n = 0;
  const { impl } = fakeFetch((url, init) => {
    if (url === "https://qron.space/" && n++ === 0) return { status: 522 };
    return healthy(url, init);
  });
  const { ok } = await runSmoke({
    fetchImpl: impl,
    retries: 2,
    delayMs: 0,
    log: () => {},
  });
  assert.equal(ok, true);
});

test("judge/isAccessRedirect basics", () => {
  assert.equal(isAccessRedirect(302, "https://x.cloudflareaccess.com/"), true);
  assert.equal(isAccessRedirect(302, "https://authichain.com/"), false);
  assert.equal(judge({ expect: 402 }, 402, null).ok, true);
  assert.equal(judge({ expect: 402 }, 200, null).ok, false);
});
