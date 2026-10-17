import { describe, expect, it } from "vitest";
import { tryHandleMcp } from "./mcp-routes";
import type { ReplayStore } from "../../../src/lib/paid-seal-verify";

const PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const SEAL = "11111111-1111-4111-8111-111111111111";

const header = Buffer.from(
  JSON.stringify({
    scheme: "exact",
    network: "base",
    payload: {
      signature: "0xsig",
      authorization: {
        from: PAYER,
        value: "50000",
        validBefore: String(Math.floor(Date.now() / 1000) + 600),
        nonce: "0xMC01",
      },
    },
  })
).toString("base64");

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

function verifyApp() {
  let calls = 0;
  const binding = {
    fetch: async () => {
      calls++;
      const pr = Buffer.from(
        JSON.stringify({ success: true, transaction: "0xMTX" })
      ).toString("base64");
      return new Response(
        JSON.stringify({ verified: false, settlement: { txHash: "0xMTX" } }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "PAYMENT-RESPONSE": pr,
          },
        }
      );
    },
  };
  return { binding, calls: () => calls };
}

function call(): Request {
  return new Request("https://authichain.com/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": header,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "verify", arguments: { sealId: SEAL } },
    }),
  });
}

// No Supabase creds -> paid MCP verify forwards to VERIFY_APP.
describe("MCP paid verify replay guard (VERIFY_APP forward)", () => {
  it("forwards once, records nonce + tx hash, then 409 on replay without forwarding", async () => {
    const kv = memKv();
    const app = verifyApp();
    const env = {
      X402_PAY_TO: PAY_TO,
      X402_PRICE_USD: "0.05",
      X402_REPLAY_KV: kv.store,
    };
    const first = await tryHandleMcp(call(), env, app.binding as never);
    expect(first?.status).toBe(200);
    expect(app.calls()).toBe(1);
    expect(kv.map.get("x402:nonce:0xmc01")?.ttl).toBe(7 * 24 * 60 * 60);
    expect(kv.map.has("x402:tx:0xmtx")).toBe(true);
    const again = await tryHandleMcp(call(), env, app.binding as never);
    expect(again?.status).toBe(409);
    expect(await again?.json()).toMatchObject({
      error: "payment_proof_already_used",
      settled: false,
    });
    expect(app.calls()).toBe(1);
  });

  it("503 replay_store_unavailable and no forward when KV is down", async () => {
    const app = verifyApp();
    const broken: ReplayStore = {
      get: async () => {
        throw new Error("down");
      },
      put: async () => {},
      delete: async () => {},
    };
    const env = {
      X402_PAY_TO: PAY_TO,
      X402_PRICE_USD: "0.05",
      X402_REPLAY_KV: broken,
    };
    const res = await tryHandleMcp(call(), env, app.binding as never);
    expect(res?.status).toBe(503);
    expect(await res?.json()).toMatchObject({
      error: "replay_store_unavailable",
    });
    expect(app.calls()).toBe(0);
  });
});

describe("MCP Supabase-settle path gets the replay store (CFA-356 P1)", () => {
  it("409 on a replayed proof, facilitator settle called once", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    let settles = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/settle")) {
        settles++;
        return Response.json({ success: true, txHash: "0xL1" });
      }
      if (url.includes("auth_seals"))
        return Response.json([
          {
            id: SEAL,
            product_id: "p",
            batch_id: "b",
            brand: "acme",
            created_at: "2026-01-01T00:00:00Z",
          },
        ]);
      return Response.json([]);
    }) as typeof fetch;
    try {
      const kv = memKv();
      const env = {
        X402_PAY_TO: PAY_TO,
        X402_PRICE_USD: "0.05",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon-test",
        X402_REPLAY_KV: kv.store,
      };
      const first = await tryHandleMcp(call(), env);
      expect(first?.status).toBe(200);
      const again = await tryHandleMcp(call(), env);
      expect(again?.status).toBe(409);
      expect(settles).toBe(1);
    } finally {
      globalThis.fetch = original;
      delete process.env.X402_FACILITATOR_URL;
      delete process.env.X402_NETWORK;
    }
  });
});
