import { afterEach, describe, expect, it } from "vitest";
import {
  authorizationNonce,
  REPLAY_TTL_SECONDS,
  replayKeys,
  resolvePaidSealVerify,
  type ReplayStore,
} from "./paid-seal-verify";

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const SEAL = "11111111-1111-4111-8111-111111111111";
const SEAL2 = "22222222-2222-4222-8222-222222222222";
const PAY_TO = "0xabc0000000000000000000000000000000000001";
const NONCE =
  "0xDE4A5866000000000000000000000000000000000000000000000000000B3E0";

function header(nonce = NONCE): string {
  return Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "base",
      payload: {
        signature: "0xsig",
        authorization: { from: PAYER, value: "50000", nonce },
      },
    })
  ).toString("base64");
}

function memKv() {
  const map = new Map<string, { v: string; ttl?: number }>();
  const store: ReplayStore = {
    async get(k) {
      return map.get(k)?.v ?? null;
    },
    async put(k, v, o) {
      map.set(k, { v, ttl: o?.expirationTtl });
    },
  };
  return { store, map };
}

function mockNet() {
  let settles = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/settle")) {
      settles++;
      return Response.json({ success: true, txHash: "0xABC" });
    }
    if (url.includes("auth_seals")) {
      return Response.json([
        {
          id: SEAL,
          product_id: "p",
          batch_id: "b",
          brand: "acme",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);
    }
    return Response.json([]);
  }) as typeof fetch;
  return { fetchImpl, settles: () => settles };
}

const base = {
  hasVerifyApp: false,
  resource: "https://authichain.com/api/v1/agent-verify",
  priceUsd: 0.05,
  payTo: PAY_TO,
  description: "AuthiChain agent verification",
  env: {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-test",
  },
};

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_NETWORK;
});

async function run(
  store: ReplayStore | null,
  net: ReturnType<typeof mockNet>,
  sealId = SEAL,
  h = header()
) {
  process.env.X402_FACILITATOR_URL = "https://facilitator.example";
  process.env.X402_NETWORK = "base";
  const original = globalThis.fetch;
  globalThis.fetch = net.fetchImpl;
  try {
    return await resolvePaidSealVerify({
      ...base,
      proofHeader: h,
      bodyText: JSON.stringify({ sealId }),
      fetchImpl: net.fetchImpl,
      replayStore: store,
    });
  } finally {
    globalThis.fetch = original;
  }
}

describe("x402 replay guard (CFA-343)", () => {
  it("extracts the EIP-3009 nonce and builds keys", () => {
    expect(authorizationNonce(header())).toBe(NONCE.toLowerCase());
    expect(replayKeys(header(), { txHash: "0xF" })).toEqual([
      `x402:nonce:${NONCE.toLowerCase()}`,
      "x402:tx:0xf",
    ]);
  });

  it("stores nonce + tx hash with a 7-day TTL after settling", async () => {
    const kv = memKv();
    const net = mockNet();
    const d = await run(kv.store, net);
    expect(d.action === "answer" && d.status).toBe(200);
    expect(net.settles()).toBe(1);
    expect(kv.map.get(`x402:nonce:${NONCE.toLowerCase()}`)?.ttl).toBe(
      REPLAY_TTL_SECONDS
    );
    expect(kv.map.has("x402:tx:0xabc")).toBe(true);
  });

  it("returns 409 on reuse and never calls settle again", async () => {
    const kv = memKv();
    const net = mockNet();
    await run(kv.store, net);
    const again = await run(kv.store, net);
    expect(again.action === "answer" && again.status).toBe(409);
    expect(again.action === "answer" && again.body).toMatchObject({
      error: "payment_proof_already_used",
      settled: false,
    });
    expect(net.settles()).toBe(1);
  });

  it("returns 409 on reuse even for the same sealId or a different sealId", async () => {
    const kv = memKv();
    const net = mockNet();
    await run(kv.store, net, SEAL);
    const other = await run(kv.store, net, SEAL2);
    expect(other.action === "answer" && other.status).toBe(409);
    expect(net.settles()).toBe(1);
  });

  it("a fresh nonce still settles", async () => {
    const kv = memKv();
    const net = mockNet();
    await run(kv.store, net);
    const fresh = await run(kv.store, net, SEAL, header("0x01"));
    expect(fresh.action === "answer" && fresh.status).toBe(200);
    expect(net.settles()).toBe(2);
  });

  it("fails closed with 503 and no settle when KV read throws", async () => {
    const net = mockNet();
    const broken: ReplayStore = {
      get: async () => {
        throw new Error("kv down");
      },
      put: async () => {},
    };
    const d = await run(broken, net);
    expect(d.action === "answer" && d.status).toBe(503);
    expect(net.settles()).toBe(0);
  });
});
