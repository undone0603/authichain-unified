import { afterEach, describe, expect, it } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import { isMcpPath, tryHandleMcp } from "./mcp-routes";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.com${path}`, init);
}

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_PAY_TO;
  delete process.env.X402_NETWORK;
});

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
            farmPaymentLink?: string;
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
      expect(body.pricing.humanCheckout.farmPaymentLink).toBe(
        planPaymentLink("strainchain_farm")
      );
      expect(
        new URL(body.pricing.humanCheckout.farmPaymentLink ?? "").hostname
      ).toBe("buy.stripe.com");
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
    expect(listed.result.tools.map(t => t.name)).toEqual(
      expect.arrayContaining(["get_pricing", "verify", "query_provenance"])
    );

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
    expect(priced.result.content[0].text).toContain(
      planPaymentLink("strainchain_farm")
    );
    expect(new URL(planPaymentLink("strainchain_farm") ?? "").hostname).toBe(
      "buy.stripe.com"
    );
    expect(priced.result.content[0].text).not.toContain("/api/checkout");
  });

  it("tools/call verify is unpaid HTTP 402, not fake SECURED JSON", async () => {
    const unpaid = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "verify", arguments: { serial: "AC-1" } },
        }),
      }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" }
    );
    expect(unpaid?.status).toBe(402);
    const body = (await unpaid!.json()) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{
        amount?: string;
        payTo?: string;
        outputSchema?: { input?: { type?: string; method?: string } };
      }>;
    };
    expect(body.x402Version).toBe(2);
    expect(body.resource?.url).toContain("/mcp");
    expect(body.accepts[0].amount).toBe("50000");
    expect(body.accepts[0].payTo).toBe(
      "0xabc0000000000000000000000000000000000001"
    );
    expect(body.accepts[0].outputSchema?.input?.type).toBe("http");
    expect(body.accepts[0].outputSchema?.input?.method).toBe("POST");
    expect(JSON.stringify(body)).not.toContain("SECURED");
    expect(unpaid!.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("tools/call verify with a payment proof is 503 and never settles", async () => {
    const orig = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ success: true, txHash: "0xabc" }));
    }) as typeof fetch;
    try {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: "exact",
          network: "base",
          payer: "0x1234567890abcdef1234567890abcdef12345678",
          amount: "50000",
          signature: "0xdead",
        })
      ).toString("base64");
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", "x-payment": proof },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: { name: "verify", arguments: { serial: "AC-1" } },
          }),
        }),
        {
          X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
          X402_FACILITATOR_URL: "https://facilitator.example",
        }
      );
      expect(res?.status).toBe(503);
      const body = (await res!.json()) as { error: string; settled: boolean };
      expect(body.error).toBe("registry_not_bound");
      expect(body.settled).toBe(false);
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("query_provenance is free and never stamps unknown IDs verified", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: {
            name: "query_provenance",
            arguments: { assetId: "NOPE-XYZ" },
          },
        }),
      })
    );
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const text = body.result.content[0].text;
    const data = JSON.parse(text) as {
      status: string;
      verified: boolean;
      compliance: string;
    };
    expect(data.status).toBe("unknown");
    expect(data.verified).toBe(false);
    expect(text).not.toContain("EU DPP Ready");
    expect(text).not.toContain("Polygon / Base");
    expect(data.compliance).toContain("$299");
  });

  it("query_provenance marks the desk seed as a sample, not an attestation", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: {
            name: "query_provenance",
            arguments: { assetId: "ac-7c2a91e4" },
          },
        }),
      })
    );
    const body = (await res!.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const data = JSON.parse(body.result.content[0].text) as {
      status: string;
      verified: boolean;
      product: { id: string };
    };
    expect(data.status).toBe("desk_sample");
    expect(data.verified).toBe(false);
    expect(data.product.id).toBe("AC-7C2A91E4");
  });

  it("unknown JSON-RPC method is 200 with -32601, not HTTP 404", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 11,
          method: "tools/bogus",
        }),
      })
    );
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as {
      error: { code: number };
    };
    expect(body.error.code).toBe(-32601);
  });

  it("tools/call verify is 503 when payTo is missing", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "authichain_verify_product" },
        }),
      })
    );
    expect(res?.status).toBe(503);
    const body = (await res!.json()) as { status: string };
    expect(body.status).toBe("not_configured");
  });

  it("unknown tool calls are errors, not fake verify", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "mint_certificate" },
        }),
      })
    );
    const body = (await res!.json()) as {
      result: { content: Array<{ text: string }>; isError?: boolean };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("verify");
    expect(body.result.content[0].text).not.toContain("SECURED");
  });

  it("returns null for other paths so APP_WORKER still owns them", async () => {
    expect(await tryHandleMcp(req("/api/checkout/dpp"))).toBeNull();
    expect(await tryHandleMcp(req("/dashboard"))).toBeNull();
  });
});

describe("mcp paid verify with the VERIFY_APP binding", () => {
  const proof = Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "base",
      payer: "0x1234567890abcdef1234567890abcdef12345678",
      amount: "50000",
      signature: "0xdead",
    })
  ).toString("base64");
  const call = () =>
    req("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-payment": proof },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "verify", arguments: { serial: "AC-1" } },
      }),
    });

  it("wraps a settled registry answer as a JSON-RPC result", async () => {
    const seen: Request[] = [];
    const res = await tryHandleMcp(
      call(),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" },
      {
        fetch: async (r: Request) => {
          seen.push(r);
          return new Response(
            JSON.stringify({ verified: false, subject: "AC-1" }),
            {
              status: 200,
              headers: { "PAYMENT-RESPONSE": "settled" },
            }
          );
        },
      }
    );
    expect(res?.status).toBe(200);
    expect(res!.headers.get("PAYMENT-RESPONSE")).toBe("settled");
    const body = (await res!.json()) as {
      id: number;
      result: { structuredContent: { subject: string } };
    };
    expect(body.id).toBe(4);
    expect(body.result.structuredContent.subject).toBe("AC-1");
    expect(seen[0].url).toBe("https://authichain.com/api/v1/agent-verify");
    expect(await seen[0].json()).toEqual({ serial: "AC-1" });
  });

  it("passes a registry refusal through as HTTP", async () => {
    const res = await tryHandleMcp(
      call(),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" },
      {
        fetch: async () =>
          new Response(JSON.stringify({ error: "seal_id_required" }), {
            status: 400,
          }),
      }
    );
    expect(res?.status).toBe(400);
  });
});
