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
];

export async function probePublic(fetchImpl = fetch) {
  const results = [];
  for (const p of PUBLIC_PROBES) {
    try {
      const res = await fetchImpl(p.url, {
        method: p.method || "GET",
        redirect: "manual",
      });
      results.push({
        id: p.id,
        url: p.url,
        status: res.status,
        ok: p.accept.includes(res.status),
      });
    } catch (err) {
      results.push({
        id: p.id,
        url: p.url,
        status: 0,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
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
