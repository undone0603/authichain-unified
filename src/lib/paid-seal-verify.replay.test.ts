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
        authorization: {
          from: PAYER,
          value: "50000",
          validBefore: String(Math.floor(Date.now() / 1000) + 600),
          nonce,
        },
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
    async delete(k) {
      map.delete(k);
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
      delete: async () => {},
    };
    const d = await run(broken, net);
    expect(d.action === "answer" && d.status).toBe(503);
    expect(net.settles()).toBe(0);
  });
});

describe("CFA-351 hardening", () => {
  function headerWith(
    auth: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ): string {
    return Buffer.from(
      JSON.stringify({
        scheme: "exact",
        network: "base",
        payload: {
          signature: "0xsig",
          authorization: { from: PAYER, value: "50000", ...auth },
        },
        ...extra,
      })
    ).toString("base64");
  }

  it("a pending marker blocks a concurrent second use (409, no settle)", async () => {
    const kv = memKv();
    kv.map.set(`x402:nonce:${NONCE.toLowerCase()}`, { v: "pending" });
    const net = mockNet();
    const d = await run(kv.store, net);
    expect(d.action === "answer" && d.status).toBe(409);
    expect(net.settles()).toBe(0);
  });

  it("writes pending before settle and overwrites it with the settled record", async () => {
    const kv = memKv();
    const seenAtSettle: Array<string | undefined> = [];
    const net = mockNet();
    const inner = net.fetchImpl;
    const wrapped = (async (i: RequestInfo | URL, init?: RequestInit) => {
      if (String(i).includes("/settle"))
        seenAtSettle.push(kv.map.get(`x402:nonce:${NONCE.toLowerCase()}`)?.v);
      return inner(i, init);
    }) as typeof fetch;
    const d = await run(kv.store, { fetchImpl: wrapped, settles: net.settles });
    expect(d.action === "answer" && d.status).toBe(200);
    expect(seenAtSettle).toEqual(["pending"]);
    expect(
      JSON.parse(kv.map.get(`x402:nonce:${NONCE.toLowerCase()}`)!.v)
    ).toMatchObject({ sealId: SEAL, txHash: "0xabc" });
  });

  it("deletes the pending marker when settle fails so the payer can retry", async () => {
    const kv = memKv();
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/settle"))
        return Response.json(
          { success: false, errorReason: "nope" },
          { status: 400 }
        );
      if (url.includes("auth_seals")) return Response.json([{ id: SEAL }]);
      return Response.json([]);
    }) as typeof fetch;
    const d = await run(kv.store, { fetchImpl, settles: () => 0 });
    expect(d.action === "answer" && d.status).toBe(402);
    expect(kv.map.size).toBe(0);
  });

  it("rejects an authorization valid for more than 7 days, before settle", async () => {
    const kv = memKv();
    const net = mockNet();
    const far = Math.floor(Date.now() / 1000) + REPLAY_TTL_SECONDS + 3600;
    const d = await run(
      kv.store,
      net,
      SEAL,
      headerWith({ nonce: "0x77", validBefore: String(far) })
    );
    expect(d.action === "answer" && d.status).toBe(402);
    expect(d.action === "answer" && d.body).toMatchObject({
      error: "authorization_validity_too_long",
    });
    expect(net.settles()).toBe(0);
    expect(kv.map.size).toBe(0);
  });

  it("accepts an authorization valid for under 7 days", async () => {
    const net = mockNet();
    const soon = Math.floor(Date.now() / 1000) + 600;
    const d = await run(
      memKv().store,
      net,
      SEAL,
      headerWith({ nonce: "0x78", validBefore: soon })
    );
    expect(d.action === "answer" && d.status).toBe(200);
  });

  it("hdr key is sha256 of the full header (headers differing past 400 chars get distinct keys)", () => {
    const pad = "x".repeat(600);
    const a = headerWith({}, { pad: pad + "a" });
    const b = headerWith({}, { pad: pad + "b" });
    const ka = replayKeys(a, {})[0];
    const kb = replayKeys(b, {})[0];
    expect(ka).toMatch(/^x402:hdr:[0-9a-f]{64}$/);
    expect(ka).not.toBe(kb);
  });
});

describe("CFA-356", () => {
  it("pending marker TTL is 300s; settled record TTL is 7 days", async () => {
    const kv = memKv();
    const ttlAtSettle: Array<number | undefined> = [];
    const net = mockNet();
    const inner = net.fetchImpl;
    const wrapped = (async (i: RequestInfo | URL, init?: RequestInit) => {
      if (String(i).includes("/settle"))
        ttlAtSettle.push(kv.map.get(`x402:nonce:${NONCE.toLowerCase()}`)?.ttl);
      return inner(i, init);
    }) as typeof fetch;
    await run(kv.store, { fetchImpl: wrapped, settles: net.settles });
    expect(ttlAtSettle).toEqual([300]);
    expect(kv.map.get(`x402:nonce:${NONCE.toLowerCase()}`)?.ttl).toBe(
      REPLAY_TTL_SECONDS
    );
  });

  it("rejects a proof with no validBefore with 402 before settle", async () => {
    const kv = memKv();
    const net = mockNet();
    const noVb = Buffer.from(
      JSON.stringify({
        scheme: "exact",
        network: "base",
        payload: {
          signature: "0xsig",
          authorization: { from: PAYER, value: "50000", nonce: "0x99" },
        },
      })
    ).toString("base64");
    const d = await run(kv.store, net, SEAL, noVb);
    expect(d.action === "answer" && d.status).toBe(402);
    expect(d.action === "answer" && d.body).toMatchObject({
      error: "authorization_missing_valid_before",
    });
    expect(net.settles()).toBe(0);
    expect(kv.map.size).toBe(0);
  });
});
