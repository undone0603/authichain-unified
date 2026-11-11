/**
 * Read-only public checkout/discovery probe for the two distinct businesses.
 * It cannot prove outside purchases, settled receipts, fulfillment, or profit.
 * No POST, wallet signing, Stripe session creation, or paid endpoint request.
 * Never send PAYMENT-SIGNATURE, X-Payment-Tx, Authorization, or Stripe cookies.
 *
 * Signal USDC (TAPE / $PEPKIN, 0.01 USDC = 10000 atomic) is a separate till
 * from Stripe Starter/DPP. Shop-reported payer counts are UNVERIFIED — not
 * revenue, not MRR, and never copied into Stripe figures.
 *
 * Starter Payment Link is the public buy.stripe.com URL from src/lib/plans.ts
 * (`starter.stripe_payment_link`). GET only; a 200 proves the link is reachable.
 */
export const STARTER_PAYMENT_LINK =
  "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E";

export const REVENUE_PROBES = Object.freeze([
  { id: "auth_starter", scope: "authichain", method: "GET", url: "https://authichain.com/checkout/starter", accepts: [200] },
  { id: "auth_dpp", scope: "authichain", method: "GET", url: "https://authichain.com/checkout/dpp_readiness", accepts: [200] },
  { id: "auth_starter_link", scope: "authichain", method: "GET", url: STARTER_PAYMENT_LINK, accepts: [200] },
  { id: "auth_dpp_head", scope: "authichain", method: "HEAD", url: "https://authichain.com/api/checkout/dpp", accepts: [204] },
  { id: "signal_offer", scope: "signal", method: "GET", url: "https://signal.authichain.com/offer", accepts: [200] },
  { id: "signal_discovery", scope: "signal", method: "GET", url: "https://signal.authichain.com/api/x402/discovery", accepts: [402] },
  { id: "signal_health", scope: "signal", method: "GET", url: "https://signal.authichain.com/health.live", accepts: [200] },
]);

const EXPECTED_ATOMIC = "10000";
const STALE_ATOMICS = new Set(["50000", "100000"]);
const FORBIDDEN_PAYMENT_HEADERS = [
  "authorization",
  "payment-signature",
  "x-payment-tx",
  "x-payment",
  "stripe-signature",
];

function headerGet(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) ?? "";
  const want = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === want) return value ?? "";
  }
  return "";
}

export function isJsonContentType(contentType) {
  const ct = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  return ct === "application/json" || ct.endsWith("+json");
}

function standaloneNumber(text, token) {
  return new RegExp(`(?:^|[^0-9])${token}(?:$|[^0-9])`).test(String(text ?? ""));
}

/** Product identity is the uppercase TAPE token plus $PEPKIN — not English "tape". */
export function hasTapePepkinIdentity(text) {
  const hay = String(text ?? "");
  const hasTape = /(?:^|[^A-Za-z0-9])TAPE(?:[^A-Za-z0-9]|$)/.test(hay);
  const hasPepkin = /\$?PEPKIN\b/i.test(hay);
  return hasTape && hasPepkin;
}

function has001Usdc(text) {
  const hay = String(text ?? "");
  return standaloneNumber(hay, "0\\.01") && /USDC/i.test(hay);
}

function jsonIdentityText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(jsonIdentityText).join("\n");
  if (typeof value !== "object") return "";
  const parts = [];
  for (const key of ["product", "description", "sku", "name", "symbol"]) {
    if (typeof value[key] === "string") parts.push(value[key]);
  }
  if (value.resource && typeof value.resource === "object") {
    parts.push(jsonIdentityText(value.resource));
  }
  if (Array.isArray(value.tags)) {
    parts.push(value.tags.filter((tag) => typeof tag === "string").join(" "));
  }
  return parts.join("\n");
}

function jsonAtomicAmounts(value) {
  const amounts = [];
  if (value == null || typeof value !== "object") return amounts;
  if (value.amount != null && value.amount !== "") amounts.push(String(value.amount));
  if (Array.isArray(value.accepts)) {
    for (const accept of value.accepts) {
      if (accept && accept.amount != null && accept.amount !== "") {
        amounts.push(String(accept.amount));
      }
    }
  }
  return amounts;
}

function priceErrorFromAtomics(amounts, dollarsOk) {
  if (amounts.some((amount) => STALE_ATOMICS.has(amount))) {
    return "stale 50000 / 100000 atomic price in TAPE offer";
  }
  const atomicOk = amounts.includes(EXPECTED_ATOMIC);
  if (!atomicOk && !dollarsOk) {
    return "missing expected 0.01 USDC / 10000 atomic price";
  }
  if (!atomicOk) return "missing expected 10000 atomic price";
  if (!dollarsOk) return "missing expected 0.01 USDC price";
  return null;
}

/** Only inspect evidence exposed by the unpaid public surfaces. */
export function checkSignalContract(id, body, contentType = "") {
  if (id !== "signal_offer" && id !== "signal_discovery" && id !== "signal_health") {
    return null;
  }
  const text = String(body ?? "");
  const json = isJsonContentType(contentType);
  let parsed = null;
  if (json) {
    if (!text.trim()) return "empty JSON body";
    try {
      parsed = JSON.parse(text);
    } catch {
      return "invalid JSON body";
    }
    if (parsed == null || typeof parsed !== "object") {
      return "JSON body is not an object";
    }
  }

  const identityText = parsed ? jsonIdentityText(parsed) : text;
  if (!hasTapePepkinIdentity(identityText)) {
    return "missing TAPE / $PEPKIN product identity";
  }

  if (id === "signal_health") {
    return null;
  }

  if (id === "signal_offer" || id === "signal_discovery") {
    if (parsed) {
      const amounts = jsonAtomicAmounts(parsed);
      const dollarsOk = has001Usdc(identityText);
      return priceErrorFromAtomics(amounts, dollarsOk);
    }
    if (standaloneNumber(text, "50000") || standaloneNumber(text, "100000")) {
      return "stale 50000 / 100000 atomic price in TAPE offer";
    }
    const atomicOk = standaloneNumber(text, EXPECTED_ATOMIC);
    const dollarsOk = has001Usdc(text);
    if (!atomicOk && !dollarsOk) return "missing expected 0.01 USDC / 10000 atomic price";
    if (!atomicOk) return "missing expected 10000 atomic price";
    if (!dollarsOk) return "missing expected 0.01 USDC price";
  }
  return null;
}

function assertNoPaymentHeaders(options) {
  const headers = options?.headers;
  if (!headers) return;
  const names = typeof headers.get === "function"
    ? []
    : Object.keys(headers);
  if (typeof headers.get === "function") {
    for (const name of FORBIDDEN_PAYMENT_HEADERS) {
      if (headers.get(name)) {
        throw new Error(`probe must not send ${name}`);
      }
    }
    return;
  }
  for (const name of names) {
    if (FORBIDDEN_PAYMENT_HEADERS.includes(String(name).toLowerCase())) {
      throw new Error(`probe must not send ${name}`);
    }
  }
}

export async function probeRevenueDiscovery(fetchImpl = fetch, now = () => new Date()) {
  const results = [];
  for (const target of REVENUE_PROBES) {
    try {
      const options = {
        method: target.method,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      };
      assertNoPaymentHeaders(options);
      const response = await fetchImpl(target.url, options);
      const contentType = headerGet(response.headers, "content-type");
      const responseBody = target.scope === "signal" && target.method === "GET"
        ? (await response.text()).slice(0, 32768)
        : "";
      const contractError = target.accepts.includes(response.status)
        ? checkSignalContract(target.id, responseBody, contentType)
        : null;
      const ok = target.accepts.includes(response.status) && !contractError;
      results.push({
        id: target.id, scope: target.scope, method: target.method,
        status: response.status, ok, contentType: contentType || null,
        reason: !target.accepts.includes(response.status)
          ? `expected HTTP ${target.accepts.join("/")} (no redirect), got ${response.status}`
          : contractError,
      });
    } catch (error) {
      results.push({
        id: target.id, scope: target.scope, method: target.method,
        status: null, ok: false, contentType: null,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    checkedAt: now().toISOString(),
    source: "public-read-only-probe",
    tills: {
      stripe: "separate",
      signalUsdc: "separate",
    },
    authichain: { publicRailsReady: results.filter(r => r.scope === "authichain").every(r => r.ok) },
    signal: { publicDiscoveryReady: results.filter(r => r.scope === "signal").every(r => r.ok) },
    // Shop-reported 7 payers / 9 payments / $0.39 is UNVERIFIED: not revenue, not MRR.
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
