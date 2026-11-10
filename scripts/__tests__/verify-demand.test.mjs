import test from "node:test";
import assert from "node:assert/strict";
import { REVENUE_PROBES, checkSignalContract, probeRevenueDiscovery } from "../revenue/verify-demand.mjs";

function mockFetch(overrides = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const id = REVENUE_PROBES.find(probe => probe.url === url)?.id;
    const cfg = overrides[id] ?? {};
    if (cfg.throw) throw new Error("unreachable");
    const status = cfg.status ?? (id === "auth_dpp_head" ? 204 : id === "signal_discovery" ? 402 : 200);
    const body = cfg.body ?? (
      id === "signal_offer" ? "Ranked TAPE $PEPKIN price 0.01 USDC, pay URL, X-Payment-Tx"
        : id === "signal_discovery" ? JSON.stringify({ sku: "discovery", tape: "$PEPKIN", amount: "10000" })
          : id === "signal_health" ? JSON.stringify({ sku: "discovery", amount: "10000" }) : ""
    );
    return { status, text: async () => body };
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
  assert.equal(report.netIncome.status, "unverified");
  assert.deepEqual(requests.map(r => r.options.method), ["GET", "GET", "HEAD", "GET", "GET", "GET"]);
  assert.ok(requests.every(r => r.options.redirect === "manual"));
  assert.ok(requests.every(r => !r.url.includes("?email=")));
  assert.equal(report.results.length, 6);
});

test("does not accept a free discovery route that should advertise 402", async () => {
  const { fetchImpl } = mockFetch({ signal_discovery: { status: 200 } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
  assert.match(report.results.find(r => r.id === "signal_discovery").reason, /402/);
});

test("rejects obsolete 0.05 / 50000 SKU claims", async () => {
  assert.match(checkSignalContract("signal_discovery", "$PEPKIN tape 50000"), /expected 0.01|50000/);
  const { fetchImpl } = mockFetch({ signal_discovery: { body: "$PEPKIN tape 50000, price 0.05" } });
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

test("a discovery result must identify tape and 0.01/10000 price", async () => {
  const { fetchImpl } = mockFetch({ signal_discovery: { body: JSON.stringify({ sku: "pass", amount: "100000" }) } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
  assert.match(report.results.find(r => r.id === "signal_discovery").reason, /PEPKIN/);
});

test("rejects 100000 atomic as 0.10 instead of the paid 0.01 TAPE", async () => {
  const { fetchImpl } = mockFetch({ signal_discovery: { body: "ranked TAPE $PEPKIN sku discovery 100000 atomic" } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
  assert.match(report.results.find(r => r.id === "signal_discovery").reason, /100000/);
});

test("does not accept contradictory 10000 and 50000 amounts on the tape card", async () => {
  const { fetchImpl } = mockFetch({ signal_offer: { body: "ranked TAPE $PEPKIN 10000 / 50000 atomic" } });
  const report = await probeRevenueDiscovery(fetchImpl);
  assert.equal(report.signal.publicDiscoveryReady, false);
});
