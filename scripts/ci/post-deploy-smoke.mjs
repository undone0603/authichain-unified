#!/usr/bin/env node
/**
 * Blocking post-deploy smoke (PM-330 item 6, CFD-265). Runs AFTER the deploy
 * jobs in deploy-cloudflare.yml and deploy-workers.yml and fails the workflow
 * when a public money / protocol surface is down or gated.
 *
 * Read-only: no Stripe session is created (checkout is HEAD; the page is a
 * confirm screen anyway), the Stripe webhook gets an UNSIGNED POST that must
 * be refused with 400, and /api/x402 gets an unpaid POST that must answer the
 * 402 challenge. Redirects are not followed: any 3xx to cloudflareaccess.com
 * (Zero Trust gate in front of a public page) fails, whatever the step.
 *
 * Expected codes match production at 8:31 AM ET Oct 9 2026.
 *
 * Usage: node scripts/ci/post-deploy-smoke.mjs   (SMOKE_RETRIES / SMOKE_DELAY_MS optional)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SMOKE_CHECKS = [
  { id: "apex_authichain", url: "https://authichain.com/", expect: 200 },
  { id: "apex_qron", url: "https://qron.space/", expect: 200 },
  { id: "apex_govchain", url: "https://govchain.us/", expect: 200 },
  { id: "apex_strainchain", url: "https://strainchain.io/", expect: 200 },
  { id: "pricing", url: "https://authichain.com/pricing", expect: 200 },
  {
    id: "checkout_dpp_readiness",
    url: "https://authichain.com/checkout/dpp_readiness",
    method: "HEAD",
    expect: 200,
  },
  { id: "mcp", url: "https://authichain.com/mcp", expect: 200 },
  {
    id: "x402_unpaid",
    url: "https://authichain.com/api/x402",
    method: "POST",
    body: "{}",
    expect: 402,
  },
  {
    id: "stripe_webhook_unsigned",
    url: "https://authichain.com/api/stripe/webhook",
    method: "POST",
    body: "{}",
    expect: 400,
  },
  {
    id: "protocol_jwks",
    url: "https://authichain.com/.well-known/jwks.json",
    expect: 200,
  },
];

export function isAccessRedirect(status, location) {
  return (
    status >= 300 &&
    status < 400 &&
    /cloudflareaccess\.com/i.test(location ?? "")
  );
}

export function judge(check, status, location) {
  if (isAccessRedirect(status, location)) {
    return { ok: false, reason: `${status} redirect to Cloudflare Access` };
  }
  if (status !== check.expect) {
    return { ok: false, reason: `got ${status}, expected ${check.expect}` };
  }
  return { ok: true, reason: `${status}` };
}

async function probe(check, fetchImpl) {
  try {
    const res = await fetchImpl(check.url, {
      method: check.method ?? "GET",
      redirect: "manual",
      headers: {
        "user-agent": "authichain-post-deploy-smoke/1 (+github actions)",
        ...(check.body ? { "content-type": "application/json" } : {}),
      },
      body: check.body,
      signal: AbortSignal.timeout(20000),
    });
    return { status: res.status, location: res.headers.get("location") };
  } catch (err) {
    return { status: 0, location: null, error: err?.name ?? "fetch_error" };
  }
}

export async function runSmoke({
  checks = SMOKE_CHECKS,
  fetchImpl = fetch,
  retries = 3,
  delayMs = 10000,
  log = console.log,
} = {}) {
  const results = [];
  for (const check of checks) {
    let verdict;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const { status, location } = await probe(check, fetchImpl);
      verdict = judge(check, status, location);
      // An Access redirect is a config state, not propagation lag: no retry.
      if (verdict.ok || isAccessRedirect(status, location)) break;
      if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
    }
    results.push({ id: check.id, url: check.url, ...verdict });
    log(
      `${verdict.ok ? "PASS" : "FAIL"} ${check.id} ${check.method ?? "GET"} ${check.url} -> ${verdict.reason}`
    );
  }
  return { ok: results.every(r => r.ok), results };
}

async function main() {
  const { ok, results } = await runSmoke({
    retries: Number(process.env.SMOKE_RETRIES ?? 3),
    delayMs: Number(process.env.SMOKE_DELAY_MS ?? 10000),
  });
  const failed = results.filter(r => !r.ok);
  if (!ok) {
    for (const f of failed)
      console.error(
        `::error::post-deploy smoke ${f.id}: ${f.reason} (${f.url})`
      );
    process.exit(1);
  }
  console.log(`Post-deploy smoke: ${results.length}/${results.length} passed.`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
