// @vitest-environment node
/**
 * RES-78 privacy fix: GET /api/ledger (served at authichain.com/buy/api/ledger)
 * must not publish buyer emails, names, Stripe ids, raw wallets or metadata.
 * Synthetic receipts only, fake KV, network stubbed off.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error -- plain JS Worker module, no type declarations
import worker from "./index.js";

const HUMAN_EMAIL = "Jane.Buyer@Example-Customer.test";
const AGENT_WALLET = "0x1111111111111111111111111111111111111111";

const seeded = {
  updatedAt: "2026-10-17T15:00:00.000Z",
  receipts: [
    {
      id: "cs_cs_test_privacy_1",
      rail: "human",
      amountCents: 100,
      currency: "usd",
      email: HUMAN_EMAIL,
      name: "Jane Buyer",
      phone: "+1 555 0100",
      address: { line1: "1 Test St" },
      stripeCustomerId: "cus_test_privacy",
      stripeCheckoutSessionId: "cs_test_privacy_1",
      stripePaymentIntentId: "pi_test_privacy_1",
      createdAt: "2026-10-17T14:00:00.000Z",
      metadata: { lead_id: "lead_real_person", customer_email: HUMAN_EMAIL },
      status: "qualified",
      reason: "Live Stripe settlement from a third-party payer.",
    },
    {
      id: "base_usdc_0xabc",
      rail: "agent",
      amountCents: 5,
      currency: "usdc",
      email: `wallet:${AGENT_WALLET}`,
      name: AGENT_WALLET,
      wallet: AGENT_WALLET,
      txHash: "0xabc",
      network: "eip155:8453",
      createdAt: "2026-10-17T14:30:00.000Z",
      metadata: { from: AGENT_WALLET },
      status: "pending",
      reason: "On-chain USDC inbound; third-party payer not proven.",
    },
  ],
};

function fakeKv() {
  const store = new Map<string, string>();
  store.set("ledger", JSON.stringify(seeded));
  store.set("onchain_sync_at", new Date().toISOString());
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

async function getLedger(path = "https://authichain.com/buy/api/ledger") {
  const res = await worker.fetch(new Request(path), { LEDGER: fakeKv() });
  const text = await res.text();
  return { res, text, body: JSON.parse(text) };
}

describe("first-dollar-desk /api/ledger privacy (RES-78)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in test");
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns 200 with no email, name, phone, address, Stripe id or metadata", async () => {
    const { res, text, body } = await getLedger();
    expect(res.status).toBe(200);
    expect(body.receipts).toHaveLength(2);
    expect(text).not.toMatch(/@/);
    expect(text.toLowerCase()).not.toContain(HUMAN_EMAIL.toLowerCase());
    expect(text).not.toContain("Jane Buyer");
    for (const leak of [
      "cus_test_privacy",
      "cs_test_privacy_1",
      "pi_test_privacy_1",
      "lead_real_person",
      "555 0100",
      "1 Test St",
      "wallet:",
    ]) {
      expect(text).not.toContain(leak);
    }
    for (const row of body.receipts) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "amountCents",
          "buyer",
          "createdAt",
          "currency",
          "network",
          "rail",
          "reason",
          "ref",
          "status",
          "txHash",
        ].sort()
      );
    }
  });

  it("keeps amount and timestamp, and masks the buyer as a 12-hex SHA-256 prefix", async () => {
    const { body } = await getLedger();
    const [human, agent] = body.receipts;
    expect(human.amountCents).toBe(100);
    expect(human.createdAt).toBe("2026-10-17T14:00:00.000Z");
    expect(human.buyer).toBe(sha(HUMAN_EMAIL.toLowerCase()).slice(0, 12));
    expect(agent.buyer).toBe(sha(AGENT_WALLET).slice(0, 12));
    expect(agent.txHash).toBe("0xabc");
  });

  it("exposes a hashed ref so the thanks page can still find a session's receipt", async () => {
    const { body } = await getLedger();
    expect(body.receipts[0].ref).toBe(sha("cs_cs_test_privacy_1").slice(0, 16));
  });

  it("redacts on the bare /api/ledger path too", async () => {
    const { text } = await getLedger(
      "https://first-dollar-desk.example/api/ledger"
    );
    expect(text).not.toMatch(/@/);
  });
});
