import { describe, expect, it } from "vitest";
import { tryHandleSisterX402 } from "./estate-x402.ts";
import { tryHandleSisterMcp } from "./estate-mcp.ts";
import type { ReplayStore } from "../../src/lib/paid-seal-verify.ts";

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const SEAL = "11111111-1111-4111-8111-111111111111";
const vb = () => String(Math.floor(Date.now() / 1000) + 600);
const hdr = (
  nonce: string,
  extra: Record<string, unknown> = { validBefore: vb() }
) =>
  Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "base",
      payload: {
        signature: "0xsig",
        authorization: { from: PAYER, value: "50000", nonce, ...extra },
      },
    })
  ).toString("base64");

function memKv() {
  const map = new Map<string, string>();
  const store: ReplayStore = {
    async get(k) {
      return map.get(k) ?? null;
    },
    async put(k, v) {
      map.set(k, v);
    },
    async delete(k) {
      map.delete(k);
    },
  };
  return { store, map };
}
function app() {
  let calls = 0;
  return {
    binding: {
      fetch: async () => {
        calls++;
        return new Response(JSON.stringify({ settlement: { txHash: "0xS" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    calls: () => calls,
  };
}
const broken: ReplayStore = {
  get: async () => {
    throw new Error("down");
  },
  put: async () => {},
  delete: async () => {},
};

const x402Req = (h: string) =>
  new Request("https://qron.space/api/x402", {
    method: "POST",
    headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": h },
    body: JSON.stringify({ sealId: SEAL }),
  });
const mcpReq = (h: string) =>
  new Request("https://qron.space/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "PAYMENT-SIGNATURE": h },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "verify", arguments: { sealId: SEAL } },
    }),
  });

describe("sister estate paid paths: replay guard (CFA-356)", () => {
  for (const [label, mk, handle] of [
    ["x402", x402Req, tryHandleSisterX402],
    [
      "mcp",
      mcpReq,
      (r: Request, e: unknown, b: unknown) =>
        tryHandleSisterMcp(r, "qron", e as never, b as never),
    ],
  ] as const) {
    it(`${label}: 409 on replay without a second forward`, async () => {
      const kv = memKv();
      const a = app();
      const env = { X402_REPLAY_KV: kv.store };
      const first = await (handle as any)(mk(hdr("0xE1")), env, a.binding);
      expect(first?.status).toBe(200);
      const again = await (handle as any)(mk(hdr("0xE1")), env, a.binding);
      expect(again?.status).toBe(409);
      expect(await again.json()).toMatchObject({
        error: "payment_proof_already_used",
      });
      expect(a.calls()).toBe(1);
    });
    it(`${label}: 503 and no forward when KV is down`, async () => {
      const a = app();
      const res = await (handle as any)(
        mk(hdr("0xE2")),
        { X402_REPLAY_KV: broken },
        a.binding
      );
      expect(res?.status).toBe(503);
      expect(a.calls()).toBe(0);
    });
    it(`${label}: 402 when validBefore is missing, no forward`, async () => {
      const a = app();
      const res = await (handle as any)(
        mk(hdr("0xE3", {})),
        { X402_REPLAY_KV: memKv().store },
        a.binding
      );
      expect(res?.status).toBe(402);
      expect(await res.json()).toMatchObject({
        error: "authorization_missing_valid_before",
      });
      expect(a.calls()).toBe(0);
    });
  }
});
