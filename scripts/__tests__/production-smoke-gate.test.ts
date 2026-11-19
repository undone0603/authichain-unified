import { describe, expect, it } from "vitest";
import {
  MCP_VERIFY_CALL,
  runSmokeGate,
  runSmokeStep,
  smokeSteps,
} from "../production-smoke-gate";

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
      "mcp_verify_record",
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
          if (path === "/mcp/free") return mcpVerifyBody("verified", []);
          return path.includes("jwks")
            ? { keys: [{ kid: "k1" }] }
            : { ok: true, ready: true };
        },
      } as Response;
    };
    const report = await runSmokeGate("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(true);
  });

  it("sends one read-only verify_record call for the published demo record", () => {
    const step = smokeSteps().find(s => s.id === "mcp_verify_record");
    expect(step?.url).toBe("https://authichain.com/mcp/free");
    expect(step?.method).toBe("POST");
    expect(step?.mcpVerify).toEqual(MCP_VERIFY_CALL);
  });

  it("fails the gate when verify_record cannot read the Polygon anchor", async () => {
    // 2026-11-19: every page served 200 while the hosted verifier returned
    // unverified for days because its Polygon RPC answered 403.
    const step = smokeSteps().find(s => s.id === "mcp_verify_record")!;
    const fetchImpl = (async () =>
      ({
        status: 200,
        clone() {
          return this;
        },
        async json() {
          return mcpVerifyBody("unverified", [
            "anchor_not_on_chain:rpc_http_error",
          ]);
        },
      }) as Response) as unknown as typeof fetch;
    const result = await runSmokeStep(step, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("rpc_http_error");
  });
});

function mcpVerifyBody(verdict: string, reasons: string[]) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: JSON.stringify({ verdict, reasons }) }],
    },
  };
}
