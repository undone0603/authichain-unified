#!/usr/bin/env node
// Easy buyer walk: discover price → (pay yourself) → save evidence →
// independent verifier → confirm settlement on Base.
//
// This script never submits a payment. Unpaid probes are labeled
// demonstration. They are not customer revenue.
//
// Usage:
//   node scripts/x402-buyer-example.mjs
//   node scripts/x402-buyer-example.mjs --live
//   node scripts/verify-paid-baseline.mjs response.json <seal-uuid>

const HOST = process.env.X402_HOST || "https://authichain.com";
const live = process.argv.includes("--live");

async function get(path) {
  const res = await fetch(`${HOST}${path}`, {
    headers: { "user-agent": "authichain-x402-buyer-example" },
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers: {
      "user-agent": "authichain-x402-buyer-example",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function usdcFromAtomic(atomic) {
  const n = Number(atomic);
  return Number.isFinite(n) ? (n / 1_000_000).toFixed(2) : null;
}

if (!live) {
  console.log(
    JSON.stringify(
      {
        label: "demonstration",
        host: HOST,
        steps: [
          "GET /api/x402/health — confirm ready, $0.05, Base USDC, payTo",
          "POST /api/x402 {} — HTTP 402 with accepts amount 50000 (USDC $0.05)",
          "POST /api/x402 {sealId: not-a-uuid} — HTTP 400 before payment",
          "Retry the same empty POST with X-PAYMENT to receive missing-seal evidence plus a settlement receipt, or POST a seal UUID",
          "Submit X-PAYMENT with your own Base USDC; save the JSON body",
          "node scripts/verify-paid-baseline.mjs response.json <seal-uuid>",
          "Confirm settlement.txHash on Base; a valid signature is not real-world truth",
        ],
        runLive: "node scripts/x402-buyer-example.mjs --live",
        verifier: "node scripts/verify-paid-baseline.mjs response.json <uuid>",
      },
      null,
      2
    )
  );
  process.exit(0);
}

const health = await get("/api/x402/health");
const unpaid = await post("/api/x402", {});
const badId = await post("/api/x402", { sealId: "probe" });
const accept = unpaid.body?.accepts?.[0];
console.log(
  JSON.stringify(
    {
      label: "demonstration",
      notCustomerRevenue: true,
      health: {
        status: health.status,
        ready: health.body?.ready,
        priceUsd: health.body?.pricePerCall?.usd,
        payTo: health.body?.payTo,
        network: health.body?.network,
      },
      discoverPrice: {
        status: unpaid.status,
        amountAtomic: accept?.amount,
        amountUsd: usdcFromAtomic(accept?.amount),
        asset: accept?.asset,
        payTo: accept?.payTo,
        network: accept?.network,
      },
      missingUuid: { status: badId.status, error: badId.body?.error },
      next: [
        "Pay with your own agent wallet (X-PAYMENT). Do not use a founder wallet.",
        "Save the 200 JSON as response.json",
        "node scripts/verify-paid-baseline.mjs response.json <seal-uuid>",
        "Look up settlement.txHash on Base. Signature validity is not authenticity.",
      ],
    },
    null,
    2
  )
);
if (health.status !== 200 || unpaid.status !== 402 || badId.status !== 400) {
  process.exitCode = 1;
}
