import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tryHandleX402 } from "./x402-routes";

/**
 * The exact routes for /api/x402 and /api/v1/agent-verify move GET too
 * (Cloudflare routes match path, not method). GET here must return the same
 * terms the edge router returns: both call x402HealthReport from src/lib/x402.
 */
const PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const paidVerifyPath = /^X402_PAID_VERIFY_PATH\s*=\s*"([^"]*)"/m.exec(toml)?.[1];
const ENV = { X402_PAY_TO: PAY_TO, X402_PRICE_USD: "0.05", X402_PAID_VERIFY_PATH: paidVerifyPath };

describe("GET terms on carved-out exact paths", () => {
  for (const path of ["/api/x402", "/api/x402/", "/api/v1/agent-verify", "/api/v1/agent-verify/"]) {
    it(`GET ${path} returns edge-equivalent terms`, async () => {
      const res = await tryHandleX402(new Request(`https://authichain.com${path}`), ENV as never);
      expect(res?.status).toBe(200);
      const b = (await res!.json()) as Record<string, any>;
      expect(b.payTo).toBe(PAY_TO);
      expect(b.network).toBe("base");
      expect(String(b.chainId)).toBe("8453");
      expect(b.asset.toLowerCase()).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
      expect(b.pricePerCall.atomic).toBe("50000");
      expect(b.paidVerify.bound).toBe(true);
    });
  }
});
