import { describe, expect, it } from "vitest";
import { tryHandleX402 } from "./x402-routes";
import type { ReplayStore } from "../../../src/lib/paid-seal-verify";

const PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const SEAL = "11111111-1111-4111-8111-111111111111";

function header(nonce = "0xAA01"): string {
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

function verifyApp(status = 200) {
  let calls = 0;
  const binding = {
    fetch: async (_r: Request) => {
      calls++;
      const pr = Buffer.from(
        JSON.stringify({ success: true, transaction: "0xTX1" })
      ).toString("base64");
      return new Response(
        JSON.stringify({ verified: false, settlement: { txHash: "0xTX1" } }),
        {
          status,
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

const ENV = { X402_PAY_TO: PAY_TO, X402_PRICE_USD: "0.05" }; // no Supabase creds -> VERIFY_APP path

function post(h: string, sealId = SEAL) {
  return new Request("https://authichain.com/api/v1/agent-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": h },
    body: JSON.stringify({ sealId }),
  });
}

describe("x402 replay guard on the VERIFY_APP forward path", () => {
  it("forwards a fresh proof once and records nonce + tx hash with 7-day TTL", async () => {
    const kv = memKv();
    const app = verifyApp();
    const res = await tryHandleX402(post(header()), ENV, app.binding as never, {
      replayStore: kv.store,
    });
    expect(res?.status).toBe(200);
    expect(app.calls()).toBe(1);
    expect(kv.map.get("x402:nonce:0xaa01")?.ttl).toBe(7 * 24 * 60 * 60);
    expect(kv.map.has("x402:tx:0xtx1")).toBe(true);
  });

  it("returns 409 on reuse without forwarding again (any sealId)", async () => {
    const kv = memKv();
    const app = verifyApp();
    await tryHandleX402(post(header()), ENV, app.binding as never, {
      replayStore: kv.store,
    });
    const again = await tryHandleX402(
      post(header(), "22222222-2222-4222-8222-222222222222"),
      ENV,
      app.binding as never,
      { replayStore: kv.store }
    );
    expect(again?.status).toBe(409);
    expect(await again?.json()).toMatchObject({
      error: "payment_proof_already_used",
      settled: false,
    });
    expect(app.calls()).toBe(1);
  });

  it("does not record a proof when VERIFY_APP refuses it (retry allowed)", async () => {
    const kv = memKv();
    const app = verifyApp(402);
    const res = await tryHandleX402(post(header()), ENV, app.binding as never, {
      replayStore: kv.store,
    });
    expect(res?.status).toBe(402);
    expect(kv.map.size).toBe(0);
  });

  it("503 and no forward when the KV read fails", async () => {
    const app = verifyApp();
    const broken: ReplayStore = {
      get: async () => {
        throw new Error("down");
      },
      put: async () => {},
    };
    const res = await tryHandleX402(post(header()), ENV, app.binding as never, {
      replayStore: broken,
    });
    expect(res?.status).toBe(503);
    expect(await res?.json()).toMatchObject({
      error: "replay_store_unavailable",
    });
    expect(app.calls()).toBe(0);
  });
});
