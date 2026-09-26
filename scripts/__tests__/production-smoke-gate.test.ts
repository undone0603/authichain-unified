import { describe, expect, it } from "vitest";
import { runSmokeGate, smokeSteps } from "../production-smoke-gate";

describe("production smoke gate", () => {
  it("covers the live Cloudflare money + verify path", () => {
    const ids = smokeSteps().map(s => s.id);
    expect(ids).toEqual([
      "origin",
      "verify_surface",
      "jwks",
      "issuer",
      "checkout_surface",
      "checkout_api",
      "checkout_dpp_head",
      "passport_head",
      "farm_head",
      "x402_health",
    ]);
    const heads = smokeSteps().filter(s => s.method === "HEAD");
    expect(heads.map(s => s.id)).toEqual([
      "checkout_dpp_head",
      "passport_head",
      "farm_head",
    ]);
  });

  it("does not GET checkout 303s or write events", () => {
    for (const step of smokeSteps()) {
      const parsed = new URL(step.url);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.hostname).toBe("authichain.com");
      if (step.url.includes("/api/checkout/dpp")) {
        expect(step.method).toBe("HEAD");
      }
      if (step.url.includes("/api/checkout/plan/")) {
        expect(step.method).toBe("HEAD");
      }
    }
  });

  it("fails the gate when JWKS has no keys", async () => {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      const status =
        path.includes("/api/checkout/") && path !== "/api/checkout" ? 204 : 200;
      const keys = path.includes("jwks") ? [] : undefined;
      return {
        status,
        clone() {
          return this;
        },
        async json() {
          return keys ? { keys } : { ok: true, ready: true };
        },
      } as Response;
    };
    const report = await runSmokeGate("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(false);
    expect(report.failed.some(f => f.id === "jwks")).toBe(true);
  });

  it("passes when every live money step returns an accepted status", async () => {
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const method = (init?.method || "GET").toUpperCase();
      const status =
        method === "HEAD" && path.startsWith("/api/checkout/") ? 204 : 200;
      return {
        status,
        clone() {
          return this;
        },
        async json() {
          return path.includes("jwks")
            ? { keys: [{ kid: "k1" }] }
            : { ok: true, ready: true };
        },
      } as Response;
    };
    const report = await runSmokeGate("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(true);
  });
});
