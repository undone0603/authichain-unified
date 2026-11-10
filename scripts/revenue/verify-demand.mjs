/**
 * Read-only public checkout/discovery probe for the two distinct businesses.
 * It cannot prove outside purchases, settled receipts, fulfillment, or profit.
 * No POST, wallet signing, Stripe session creation, or paid endpoint request.
 */
export const REVENUE_PROBES = Object.freeze([
  { id: "auth_starter", scope: "authichain", method: "GET", url: "https://authichain.com/checkout/starter", accepts: [200] },
  { id: "auth_dpp", scope: "authichain", method: "GET", url: "https://authichain.com/checkout/dpp_readiness", accepts: [200] },
  { id: "auth_dpp_head", scope: "authichain", method: "HEAD", url: "https://authichain.com/api/checkout/dpp", accepts: [204] },
  { id: "signal_offer", scope: "signal", method: "GET", url: "https://signal.authichain.com/offer", accepts: [200] },
  { id: "signal_discovery", scope: "signal", method: "GET", url: "https://signal.authichain.com/api/x402/discovery", accepts: [402] },
  { id: "signal_health", scope: "signal", method: "GET", url: "https://signal.authichain.com/health.live", accepts: [200] },
]);

/** Only inspect evidence exposed by the unpaid public surfaces. */
export function checkSignalContract(id, body) {
  const text = String(body ?? "");
  // Match exact amounts: 100000 ($0.10) is NOT 10000 ($0.01).
  const atomic10000 = /(?:^|[^0-9])10000(?:$|[^0-9])/.test(text);
  const dollars001 = /(?:^|[^0-9])0\.01(?:$|[^0-9])/.test(text);
  const wrongAmount = /(?:^|[^0-9])(?:50000|100000)(?:$|[^0-9])/.test(text);
  if (id === "signal_offer" || id === "signal_discovery") {
    if (!/PEPKIN|ranked\s+tape/i.test(text)) return "missing TAPE / PEPKIN product identity";
    if (wrongAmount) return "stale 50000 / 100000 atomic price in TAPE offer";
    if (!atomic10000 && !dollars001) return "missing expected 0.01 USDC / 10000 atomic price";
  }
  if (id === "signal_health") {
    if (!/discovery/i.test(text) || !atomic10000) {
      return "missing idle discovery SKU / 10000 atomic evidence";
    }
  }
  return null;
}

export async function probeRevenueDiscovery(fetchImpl = fetch, now = () => new Date()) {
  const results = [];
  for (const target of REVENUE_PROBES) {
    try {
      const response = await fetchImpl(target.url, {
        method: target.method,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      const responseBody = target.scope === "signal" && target.method === "GET"
        ? (await response.text()).slice(0, 32768)
        : "";
      const contractError = target.accepts.includes(response.status)
        ? checkSignalContract(target.id, responseBody)
        : null;
      const ok = target.accepts.includes(response.status) && !contractError;
      results.push({
        id: target.id, scope: target.scope, method: target.method,
        status: response.status, ok,
        reason: !target.accepts.includes(response.status)
          ? `expected HTTP ${target.accepts.join("/")} (no redirect), got ${response.status}`
          : contractError,
      });
    } catch (error) {
      results.push({
        id: target.id, scope: target.scope, method: target.method,
        status: null, ok: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    checkedAt: now().toISOString(),
    source: "public-read-only-probe",
    base: "Base USDC",
    authichain: { publicRailsReady: results.filter(r => r.scope === "authichain").every(r => r.ok) },
    signal: { publicDiscoveryReady: results.filter(r => r.scope === "signal").every(r => r.ok) },
    // Nothing returned by public endpoints establishes external sales or profit.
    revenueOutside: { status: "unverified", amountUsd: null, payerCount: null, paymentCount: null },
    netIncome: { status: "unverified", amountUsd: null },
    results,
  };
}

if (process.argv[1] && /(?:^|[\\/])verify-demand\.mjs$/.test(process.argv[1])) {
  probeRevenueDiscovery()
    .then(report => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.authichain.publicRailsReady || !report.signal.publicDiscoveryReady) process.exitCode = 1;
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
