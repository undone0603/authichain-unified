#!/usr/bin/env node
/**
 * Read-only Cloudflare + public-edge health from main.
 * Never deploys. Never prints secret values.
 */
const ORIGIN = process.env.AUTHICHAIN_ORIGIN || "https://authichain.com";

export const PUBLIC_PROBES = [
  { id: "apex", url: `${ORIGIN}/`, accept: [200] },
  { id: "jwks", url: `${ORIGIN}/protocol/jwks.json`, accept: [200] },
  { id: "x402", url: `${ORIGIN}/api/x402/health`, accept: [200] },
  { id: "pricing", url: `${ORIGIN}/pricing`, accept: [200] },
  {
    id: "checkout_dpp_head",
    url: `${ORIGIN}/api/checkout/dpp`,
    accept: [204],
    method: "HEAD",
  },
  {
    // Retired for new buyers (RES-86c). tryHandleGatedCheckout answers every
    // method, including HEAD, with 303 to /pricing and never calls Stripe.
    // A 200 would mean the confirm page reopened. Any other Location, including
    // a Stripe host, is a failure. Aliases such as /checkout/launch answer 301.
    id: "checkout_launch_annual_confirm_head",
    url: `${ORIGIN}/checkout/qron_launch_annual`,
    accept: [303],
    locationPath: "/pricing",
    method: "HEAD",
  },
];

function failureDetail(err) {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause;
  const code =
    cause && typeof cause === "object" && "code" in cause ? cause.code : "";
  return code ? `${err.message}: ${code}` : err.message;
}

function redirectMatches(res, probe) {
  if (!probe.locationPath) return true;
  const raw = res.headers.get("location");
  if (!raw) return false;
  try {
    const loc = new URL(raw, probe.url);
    const expected = new URL(probe.locationPath, probe.url);
    return loc.origin === expected.origin && loc.pathname === expected.pathname;
  } catch {
    return false;
  }
}

export async function probePublic(fetchImpl = fetch) {
  const results = [];
  for (const p of PUBLIC_PROBES) {
    try {
      const res = await fetchImpl(p.url, {
        method: p.method || "GET",
        redirect: "manual",
      });
      const location = res.headers.get("location") || undefined;
      results.push({
        id: p.id,
        url: p.url,
        status: res.status,
        ok: p.accept.includes(res.status) && redirectMatches(res, p),
        ...(location ? { location } : {}),
      });
    } catch (err) {
      results.push({
        id: p.id,
        url: p.url,
        status: 0,
        ok: false,
        detail: failureDetail(err),
      });
    }
  }
  return results;
}

export async function probeCloudflareApi() {
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  if (!token || !account) {
    return { skipped: true, reason: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID unset" };
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return {
    skipped: false,
    ok: res.ok,
    status: res.status,
    // names only — never dump script bodies or secrets
    workerCount: res.ok ? ((await res.json())?.result?.length ?? null) : null,
  };
}

if (process.argv.includes("--run")) {
  const pub = await probePublic();
  const api = await probeCloudflareApi();
  const report = { public: pub, cloudflareApi: api };
  console.log(JSON.stringify(report, null, 2));
  if (pub.some((p) => !p.ok)) process.exit(1);
}
