import { describe, expect, it } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { isMcpPath, tryHandleMcp } from "./mcp-routes";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.com${path}`, init);
}

describe("mcp discovery", () => {
  it("recognizes agent MCP paths and ignores checkout", () => {
    expect(isMcpPath("/mcp")).toBe(true);
    expect(isMcpPath("/mcp/")).toBe(true);
    expect(isMcpPath("/api/mcp")).toBe(true);
    expect(isMcpPath("/.well-known/mcp.json")).toBe(true);
    expect(isMcpPath("/api/x402")).toBe(false);
    expect(isMcpPath("/api/checkout/dpp")).toBe(false);
  });

  it("GET discovery points at Payment Links and unpaid POST x402, not GET checkout", async () => {
    for (const path of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
      const res = await tryHandleMcp(req(path));
      expect(res, path).not.toBeNull();
      expect(res!.status, path).toBe(200);
      const body = (await res!.json()) as {
        protocol: string;
        pay: { x402: string };
        pricing: {
          humanCheckout: {
            passportPaymentLink?: string;
            dppPaymentLink?: string;
          };
        };
      };
      expect(body.protocol).toBe("mcp");
      expect(body.pay.x402).toBe("POST https://authichain.com/api/x402");
      expect(body.pricing.humanCheckout.dppPaymentLink).toBe(
        planPaymentLink("dpp_readiness")
      );
      expect(body.pricing.humanCheckout.passportPaymentLink).toBe(
        planPaymentLink("strainchain_passport")
      );
      expect(JSON.stringify(body)).not.toContain("/api/checkout");
    }
  });

  it("JSON-RPC tools/list and get_pricing are public", async () => {
    const list = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );
    expect(list?.status).toBe(200);
    const listed = (await list!.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(listed.result.tools.map(t => t.name)).toContain("get_pricing");

    const call = await tryHandleMcp(
      req("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "get_pricing" },
        }),
      })
    );
    const priced = (await call!.json()) as {
      result: { content: Array<{ text: string }> };
    };
    expect(priced.result.content[0].text).toContain(
      "POST /api/v1/agent-verify"
    );
    expect(priced.result.content[0].text).toContain(
      planPaymentLink("strainchain_passport")
    );
    expect(priced.result.content[0].text).not.toContain("/api/checkout");
  });

  it("unknown tool calls point at unpaid POST x402 instead of fake verify", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "authichain_verify_product" },
        }),
      })
    );
    const body = (await res!.json()) as {
      result: { content: Array<{ text: string }>; isError?: boolean };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain(
      "POST https://authichain.com/api/x402"
    );
    expect(body.result.content[0].text).not.toContain("SECURED");
  });

  it("returns null for other paths so APP_WORKER still owns them", async () => {
    expect(await tryHandleMcp(req("/api/checkout/dpp"))).toBeNull();
    expect(await tryHandleMcp(req("/dashboard"))).toBeNull();
  });
});
