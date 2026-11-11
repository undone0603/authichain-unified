import test from "node:test";
import assert from "node:assert/strict";
import {
  REVENUE_PROBES,
  STARTER_PAYMENT_LINK,
  checkSignalContract,
  hasTapePepkinIdentity,
  probeRevenueDiscovery,
} from "../revenue/verify-demand.mjs";

const OFFER_JSON = JSON.stringify({
  product: "Ranked TAPE $PEPKIN",
  description: "0.01 USDC on Base. Settle with X-Payment-Tx.",
  amount: "10000",
  sku: "discovery",
});
const DISCOVERY_JSON = JSON.stringify({
  resource: { description: "Ranked TAPE $PEPKIN. 0.01 USDC. Not a broadcast order." },
  accepts: [{ scheme: "exact", amount: "10000", asset: "USDC" }],
});
const HEALTH_HTML = '<a id="link-tape"><span>x402 TAPE</span></a><span>PAY 0.01 $PEPKIN</span>';

function mockFetch(overrides = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const id = REVENUE_PROBES.find(probe => probe.url === url)?.id;
    const cfg = overrides[id] ?? {};
    if (cfg.throw) throw new Error("unreachable");
    const status = cfg.status ?? (
      id === "auth_dpp_head" ? 204 : id === "signal_discovery" ? 402 : 200
    );
    const body = cfg.body ?? (
      id === "signal_offer" ? OFFER_JSON
        : id === "signal_discovery" ? DISCOVERY_JSON
          : id === "signal_health" ? HEALTH_HTML
            : ""
    );
    const contentType = cfg.contentType ?? (
      id === "signal_offer" || id === "signal_discovery"
        ? "application/json; charset=utf-8"
        : id === "signal_health"
          ? "text/html; charset=utf-8"
          : "text/html; charset=utf-8"
    );
    return {
      status,
      headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
      text: async () => body,
    };
  };
  return { fetchImpl, requests };
}

test("checks only harmless fixed public GET / HEAD routes; revenue remains unknown", async () => {
  const { fetchImpl, requests } = mockFetch();
  const report = await probeRevenueDiscovery(fetchImpl, () => new Date("2026-11-09T20:00:00Z"));
  assert.equal(report.checkedAt, "2026-11-09T20:00:00.000Z");
  assert.equal(report.authichain.publicRailsReady, true);
  assert.equal(report.signal.publicDiscoveryReady, true);
  assert.equal(report.revenueOutside.amountUsd, null);
  assert.equal(report.revenueOutside.status, "unverified");
  assert.equal(report.revenueOutside.payerCount, null);
  assert.equal(report.revenueOutside.paymentCount, null);
  assert.equal(report.netIncome.status, "unverified");
  assert.equal(report.tills.stripe, "separate");
  assert.equal(report.tills.signalUsdc, "separate");
  assert.deepEqual(
    requests.map(r => r.options.method),
    ["GET", "GET", "GET", "HEAD", "GET", "GET", "GET"],
  );
  assert.ok(requests.every(r => r.options.redirect === "manual"));
  assert.ok(requests.every(r => !r.url.includes("?email=")));
  assert.ok(requests.some(r => r.url === STARTER_PAYMENT_LINK));
  assert.equal(report.results.length, 7);
  assert.equal(REVENUE_PROBES.find(p => p.id === "auth_starter_link").url, STARTER_PAYMENT_LINK);
});

test("does not accept a free discovery route that should advertise 402", async () => {
  const { fetchImpl } = mockFetch({ signal_discovery: { status: 200 } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
  assert.match(report.results.find(r => r.id === "signal_discovery").reason, /402/);
});

test("rejects obsolete 0.05 / 50000 SKU claims", async () => {
  assert.match(
    checkSignalContract("signal_discovery", "Ranked TAPE $PEPKIN 50000 0.01 USDC"),
    /50000/,
  );
  const { fetchImpl } = mockFetch({
    signal_discovery: {
      body: JSON.stringify({
        resource: { description: "TAPE $PEPKIN 0.05 USDC" },
        accepts: [{ amount: "50000" }],
      }),
      contentType: "application/json",
    },
  });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
});

test("does not consider wrong DPP HEAD or redirects as live money rails", async () => {
  const { fetchImpl } = mockFetch({ auth_dpp_head: { status: 404 }, auth_starter: { status: 302 } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.authichain.publicRailsReady, false);
  assert.equal(report.revenueOutside.paymentCount, null);
});

test("a failed public fetch is unknown rather than a verified sale", async () => {
  const { fetchImpl } = mockFetch({ signal_offer: { throw: true } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
  assert.match(report.results.find(r => r.id === "signal_offer").reason, /unreachable/);
  assert.equal(report.revenueOutside.payerCount, null);
});

test("ranked tape without $PEPKIN is not the product identity", () => {
  assert.equal(hasTapePepkinIdentity("ranked tape price 0.01 USDC 10000"), false);
  assert.match(
    checkSignalContract(
      "signal_discovery",
      JSON.stringify({
        product: "ranked tape",
        description: "0.01 USDC",
        amount: "10000",
      }),
      "application/json",
    ),
    /PEPKIN/,
  );
});

test("offer and discovery require BOTH 0.01 USDC AND 10000 atomic", () => {
  const identity = { product: "TAPE $PEPKIN", description: "pay on Base" };
  assert.match(
    checkSignalContract(
      "signal_offer",
      JSON.stringify({ ...identity, amount: "10000" }),
      "application/json",
    ),
    /0\.01 USDC/,
  );
  assert.match(
    checkSignalContract(
      "signal_offer",
      JSON.stringify({ product: "TAPE $PEPKIN", description: "0.01 USDC" }),
      "application/json",
    ),
    /10000 atomic/,
  );
  assert.equal(
    checkSignalContract("signal_offer", OFFER_JSON, "application/json"),
    null,
  );
  assert.equal(
    checkSignalContract("signal_discovery", DISCOVERY_JSON, "application/json"),
    null,
  );
});

test("parses JSON amounts instead of regex-on-body when content-type is JSON", () => {
  const body = JSON.stringify({
    product: "TAPE $PEPKIN",
    description: "0.01 USDC",
    amount: "10000",
    outside: { payerCount: 7, payments: 9, usdcInTotal: 390000, note: "100000 looks like 0.10" },
  });
  assert.equal(checkSignalContract("signal_offer", body, "application/json"), null);
  assert.match(
    checkSignalContract("signal_offer", body, "text/html"),
    /100000|50000/,
  );
});

test("JSON 10000 in an unrelated nested field does not satisfy the atomic price", () => {
  assert.match(
    checkSignalContract(
      "signal_discovery",
      JSON.stringify({
        resource: { description: "TAPE $PEPKIN 0.01 USDC" },
        accepts: [{ amount: "25000" }],
        outside: { usdcInTotal: 10000 },
      }),
      "application/json",
    ),
    /10000 atomic/,
  );
});

test("health.live requires the same TAPE / $PEPKIN identity", () => {
  assert.equal(checkSignalContract("signal_health", HEALTH_HTML, "text/html"), null);
  assert.match(
    checkSignalContract("signal_health", "<span>x402 TAPE</span> PAY 0.01", "text/html"),
    /PEPKIN/,
  );
  assert.match(
    checkSignalContract(
      "signal_health",
      JSON.stringify({ sku: "discovery", amount: "10000", product: "ranked tape" }),
      "application/json",
    ),
    /PEPKIN/,
  );
});

test("rejects 100000 atomic as 0.10 instead of the paid 0.01 TAPE", async () => {
  const { fetchImpl } = mockFetch({
    signal_discovery: {
      body: JSON.stringify({
        resource: { description: "TAPE $PEPKIN 0.01 USDC" },
        accepts: [{ amount: "100000" }],
      }),
      contentType: "application/json",
    },
  });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
  assert.match(report.results.find(r => r.id === "signal_discovery").reason, /100000/);
});

test("does not accept contradictory 10000 and 50000 amounts on the tape card", async () => {
  const { fetchImpl } = mockFetch({
    signal_offer: {
      body: JSON.stringify({
        product: "TAPE $PEPKIN",
        description: "0.01 USDC",
        amount: "10000",
        accepts: [{ amount: "50000" }],
      }),
      contentType: "application/json",
    },
  });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
});

test("Starter Payment Link failure keeps Stripe rails unready and Signal separate", async () => {
  const { fetchImpl } = mockFetch({ auth_starter_link: { status: 404 } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.authichain.publicRailsReady, false);
  assert.equal(report.signal.publicDiscoveryReady, true);
  assert.equal(report.revenueOutside.status, "unverified");
});
