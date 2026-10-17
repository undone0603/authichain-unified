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
const AGENT_TX = "0x" + "ab".repeat(32);

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
      txHash: "pi_test_privacy_leak",
      network: "stripe",
    },
    {
      id: "base_usdc_0xabc",
      rail: "agent",
      amountCents: 5,
      currency: "usdc",
      email: `wallet:${AGENT_WALLET}`,
      name: AGENT_WALLET,
      wallet: AGENT_WALLET,
      txHash: AGENT_TX,
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
  store.set("stripe_session_queue", JSON.stringify(["cs_test_queue_1"]));
  store.set(
    "stripe_webhook_last",
    JSON.stringify({ at: "2026-10-17T14:00:00.000Z", type: "checkout.session.completed", sessionId: "cs_test_privacy_1", amountCents: 100, paymentLink: "plink_test_1", receiptStatus: "qualified", receiptId: "cs_cs_test_privacy_1" })
  );
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
      "pi_test_privacy_leak",
      AGENT_WALLET,
    ]) {
      expect(text).not.toContain(leak);
    }
    for (const row of body.receipts) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "amountCents",
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

  it("keeps amount and timestamp and publishes no buyer field at all", async () => {
    const { text, body } = await getLedger();
    const [human, agent] = body.receipts;
    expect(human.amountCents).toBe(100);
    expect(human.createdAt).toBe("2026-10-17T14:00:00.000Z");
    for (const row of body.receipts) expect(row).not.toHaveProperty("buyer");
    expect(text).not.toContain(sha(HUMAN_EMAIL.toLowerCase()).slice(0, 12));
    expect(text).not.toContain(sha(AGENT_WALLET).slice(0, 12));
    expect(agent.txHash).toBe(AGENT_TX);
  });

  it("sets txHash (and network) to null on Stripe receipts, even if an old record stored one", async () => {
    const { body } = await getLedger();
    const human = body.receipts[0];
    expect(human.rail).toBe("human");
    expect(human.txHash).toBeNull();
    expect(human.network).toBeNull();
  });

  it("redacts old-format stored receipts at read time (stored records keep their raw fields)", async () => {
    const kv = fakeKv();
    const res = await worker.fetch(new Request("https://authichain.com/buy/api/ledger"), { LEDGER: kv });
    const text = await res.text();
    expect(text).not.toMatch(/@/);
    expect(text).not.toContain("Jane Buyer");
    // The raw stored record still carries email/name: redaction is a read-time view.
    expect(kv.store.get("ledger")).toContain("Jane Buyer");
  });

  it("shows the public-ledger notice verbatim next to the pay buttons", async () => {
    const notice =
      "Paid receipts appear on a public ledger with the amount, time and payment rail. On-chain payments also show the transaction hash, which is already public on Base. Your email and name are never published.";
    for (const path of ["https://authichain.com/buy", "https://authichain.com/buy/human", "https://authichain.com/buy/agent"]) {
      const res = await worker.fetch(new Request(path, { headers: { accept: "text/html" } }), { LEDGER: fakeKv() });
      const html = await res.text();
      expect(res.status, path).toBe(200);
      expect(html, path).toContain(notice);
    }
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
  it("publishes no cs_ id and no email in /api/goal, MCP get_goal or /buy/api/ledger JSON", async () => {
    const mcp = new Request("https://authichain.com/buy/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_goal", arguments: {} } }),
    });
    for (const req of [
      new Request("https://authichain.com/buy/api/goal"),
      new Request("https://authichain.com/buy/api/ledger"),
      mcp,
    ]) {
      const res = await worker.fetch(req, { LEDGER: fakeKv() });
      const text = await res.text();
      expect(res.status, req.url).toBe(200);
      expect(text, req.url).not.toContain("cs_");
      expect(text, req.url).not.toContain("plink_");
      expect(text, req.url).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    }
    const goal = await (await worker.fetch(new Request("https://authichain.com/buy/api/goal"), { LEDGER: fakeKv() })).json();
    expect(["number", "object"]).toContain(typeof goal.stripeIngestion.thanksQueueDepth);
    expect(goal.stripeIngestion).not.toHaveProperty("thanksQueueSessionIds");
    expect(goal.stripeIngestion.lastWebhook.receiptStatus).toBe("qualified");
  });
  it("C1: publishes only {skipped, webhook, written, errorCount} for Stripe sync, no plink_ or Stripe error text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const u = String((input as { url?: string })?.url ?? input);
        if (u.includes("api.stripe.com")) {
          return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "Invalid API Key provided: sk_test_****" } }), { status: 401 });
        }
        throw new Error("network disabled in test");
      })
    );
    const kv = fakeKv();
    const res = await worker.fetch(new Request("https://authichain.com/buy/api/ledger"), { LEDGER: kv, STRIPE_SECRET_KEY: "sk_test_dummy_value" });
    const text = await res.text();
    const body = JSON.parse(text);
    expect(res.status).toBe(200);
    expect(Object.keys(body.stripe).sort()).toEqual(["errorCount", "skipped", "webhook", "written"]);
    expect(body.stripe.errorCount).toBeGreaterThan(0);
    expect(text).not.toContain("plink_");
    expect(text).not.toContain("Invalid API Key");
    expect(text).not.toContain("sk_test");
  });

  it("H1: a cs_ / Stripe-session receipt never publishes txHash, even with a valid-looking 0x hash", async () => {
    const kv = fakeKv();
    const led = JSON.parse(kv.store.get("ledger")!);
    led.receipts.push({ id: "cs_cs_test_h1", rail: "agent", amountCents: 100, currency: "usd", txHash: AGENT_TX, network: "eip155:8453", createdAt: "2026-10-17T14:40:00.000Z", status: "pending" });
    led.receipts.push({ id: "x402_h1", rail: "agent", amountCents: 100, currency: "usdc", stripeCheckoutSessionId: "cs_test_h1b", txHash: AGENT_TX, network: "eip155:8453", createdAt: "2026-10-17T14:41:00.000Z", status: "pending" });
    kv.store.set("ledger", JSON.stringify(led));
    const body = await (await worker.fetch(new Request("https://authichain.com/buy/api/ledger"), { LEDGER: kv })).json();
    const rows = body.receipts.filter((r: { createdAt: string }) => r.createdAt.startsWith("2026-10-17T14:4"));
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.txHash).toBeNull();
      expect(r.network).toBeNull();
    }
  });
});
