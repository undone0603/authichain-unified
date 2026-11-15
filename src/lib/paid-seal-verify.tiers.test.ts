import { afterEach, describe, expect, it } from "vitest";
import { resolvePaidSealVerify } from "./paid-seal-verify";

function kvStub() {
  const m = new Map<string, string>();
  return {
    get: async (k: string) => m.get(k) ?? null,
    put: async (k: string, v: string) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
  };
}

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const PAY_TO = "0xabc0000000000000000000000000000000000001";
const SERVICE = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
};

function proof(amount: string, extra: Record<string, unknown> = {}): string {
  return Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount,
      validBefore: String(Math.floor(Date.now() / 1000) + 600),
      signature: "0xdead",
      ...extra,
    })
  ).toString("base64");
}

const realFetch = globalThis.fetch;

type Call = { url: string; method: string; body?: string };

function world(ledgerRows: Array<{ workflow_name: string }> = []) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes("/settle")) {
      return Response.json({ success: true, txHash: "0xabc" });
    }
    if (url.includes("automation_logs") && method === "GET") {
      return Response.json(ledgerRows);
    }
    return Response.json([]);
  }) as typeof fetch;
  // settlePayment() calls the global fetch, not the injected one.
  globalThis.fetch = fetchImpl;
  return { fetchImpl, calls };
}

const base = {
  hasVerifyApp: false,
  payTo: PAY_TO,
  description: "tiers",
  env: SERVICE,
  bodyText: "{}",
};

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_NETWORK;
  delete process.env.X402_DAILY_CAP_USD;
});

function setup() {
  process.env.X402_FACILITATOR_URL = "https://facilitator.example";
  process.env.X402_NETWORK = "base";
}

const spendRows = (calls: Call[]) =>
  calls
    .filter(c => c.method === "POST" && c.url.includes("automation_logs"))
    .map(c => JSON.parse(c.body ?? "{}") as { workflow_name: string });

describe("signal tiers through resolvePaidSealVerify", () => {
  it("ping: settles $0.01, returns existence only, logs the ping ledger", async () => {
    setup();
    const { fetchImpl, calls } = world();
    const d = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402?tier=ping",
      priceUsd: 0.01,
      tier: "ping",
      proofHeader: proof("10000"),
      replayStore: kvStub(),
      fetchImpl,
    });
    expect(d).toMatchObject({
      action: "answer",
      status: 200,
      body: { tier: "ping", registered: false, scope: "registry-existence" },
    });
    const body = (d as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("baseline");
    expect(spendRows(calls)).toEqual([
      expect.objectContaining({ workflow_name: "x402_spend_ping" }),
    ]);
  });

  it("evidence: settles $0.10, adds a digest, never claims verified, logs the evidence ledger", async () => {
    setup();
    const { fetchImpl, calls } = world();
    const d = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402?tier=evidence",
      priceUsd: 0.1,
      tier: "evidence",
      proofHeader: proof("100000"),
      replayStore: kvStub(),
      fetchImpl,
    });
    const body = (d as { body: Record<string, any> }).body;
    expect(body.verified).toBe(false);
    expect(body.tier).toBe("evidence");
    expect(body.evidence.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(spendRows(calls)[0]?.workflow_name).toBe("x402_spend_evidence");
  });

  it("default (no tier) still bills the legacy ledger at $0.05 with an unchanged body", async () => {
    setup();
    const { fetchImpl, calls } = world();
    const d = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402",
      priceUsd: 0.05,
      proofHeader: proof("50000"),
      replayStore: kvStub(),
      fetchImpl,
    });
    const body = (d as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("tier");
    expect(body).toHaveProperty("baseline");
    expect(spendRows(calls)[0]?.workflow_name).toBe("x402_spend");
  });

  it("an underpayment for a higher tier is refused before settlement", async () => {
    setup();
    const { fetchImpl, calls } = world();
    const d = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402?tier=evidence",
      priceUsd: 0.1,
      tier: "evidence",
      proofHeader: proof("10000"), // paid the ping price
      replayStore: kvStub(),
      fetchImpl,
    });
    expect(d).toMatchObject({ action: "answer", status: 402 });
    expect(calls.some(c => c.url.includes("/settle"))).toBe(false);
    expect(spendRows(calls)).toEqual([]);
  });

  it("the daily cap sums mixed tiers at each tier's own price", async () => {
    setup();
    // 99 evidence calls = $9.90 of the $10 cap.
    const ninetyNine = Array.from({ length: 99 }, () => ({
      workflow_name: "x402_spend_evidence",
    }));
    const ok = world(ninetyNine);
    const allowed = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402?tier=evidence",
      priceUsd: 0.1,
      tier: "evidence",
      proofHeader: proof("100000"),
      replayStore: kvStub(),
      fetchImpl: ok.fetchImpl,
    });
    expect(allowed).toMatchObject({ status: 200 }); // $9.90 + $0.10 = $10.00, not over

    const over = world([
      ...ninetyNine,
      { workflow_name: "x402_spend_ping" }, // +$0.01 => $9.91
    ]);
    const refused = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402?tier=evidence",
      priceUsd: 0.1,
      tier: "evidence",
      proofHeader: proof("100000", { validBefore: String(Math.floor(Date.now() / 1000) + 601) }),
      replayStore: kvStub(),
      fetchImpl: over.fetchImpl,
    });
    expect(refused).toMatchObject({
      status: 402,
      body: { error: "daily_spend_cap_exceeded" },
    });
    expect(over.calls.some(c => c.url.includes("/settle"))).toBe(false);
  });

  it("many cheap pings do not trip the cap the way verify-priced rows would", async () => {
    setup();
    // 500 pings = $5.00. Priced as verify calls this would be $25 and refuse.
    const pings = Array.from({ length: 500 }, () => ({
      workflow_name: "x402_spend_ping",
    }));
    const w = world(pings);
    const d = await resolvePaidSealVerify({
      ...base,
      resource: "https://authichain.com/api/x402?tier=ping",
      priceUsd: 0.01,
      tier: "ping",
      proofHeader: proof("10000"),
      replayStore: kvStub(),
      fetchImpl: w.fetchImpl,
    });
    expect(d).toMatchObject({ status: 200 });
  });
});
