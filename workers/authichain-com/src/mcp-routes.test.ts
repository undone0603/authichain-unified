import { afterEach, describe, expect, it } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import {
  ANCHOR_EXAMPLE_TX,
  isMcpPath,
  tryHandleMcp,
  verifyRecordTool,
} from "./mcp-routes";
import anchorJson from "../../../protocol/examples/polygon-anchor-1.anchor.json" with { type: "json" };
import recordJson from "../../../protocol/examples/polygon-anchor-1.record.json" with { type: "json" };

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
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
    expect(isMcpPath("https://authichain.com/checkout/dpp_readiness")).toBe(
      false
    );
  });

  it("GET discovery says verify is free and lists no prices or Payment Links", async () => {
    for (const path of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
      const res = await tryHandleMcp(req(path));
      expect(res, path).not.toBeNull();
      expect(res!.status, path).toBe(200);
      const body = (await res!.json()) as {
        protocol: string;
        pay: { x402: string };
        pricing: {
          verify: { price: string; mcpTool: string };
          paidPlans: { status: string };
          humanCheckout?: unknown;
        };
      };
      expect(body.protocol).toBe("mcp");
      expect(body.pay.x402).toBe("POST https://authichain.com/api/x402");
      expect(body.pricing.verify.price).toBe("free");
      expect(body.pricing.verify.mcpTool).toBe("verify_record");
      expect(body.pricing.paidPlans.status).toBe("on_hold");
      expect(body.pricing.humanCheckout).toBeUndefined();
      const text = JSON.stringify(body);
      expect(text).not.toContain("$0.05");
      expect(text).not.toContain("PaymentLink");
      expect(text).not.toContain("USDC");
      for (const plan of ["dpp_readiness", "strainchain_passport", "strainchain_farm"] as const) {
        const link = planPaymentLink(plan);
        if (link) expect(text).not.toContain(link);
      }
      expect(text).not.toContain("/api/checkout");
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
    const pricing = JSON.parse(priced.result.content[0].text) as {
      verify: { price: string; mcpTool: string; http: string };
      paidPlans: { status: string };
    };
    expect(pricing.verify.price).toBe("free");
    expect(pricing.verify.mcpTool).toBe("verify_record");
    expect(pricing.verify.http).toBe(
      "GET https://authichain.com/api/verify?id=polygon-anchor-1"
    );
    expect(pricing.paidPlans.status).toBe("on_hold");
    expect(priced.result.content[0].text).not.toContain("$0.05");
    expect(priced.result.content[0].text).not.toContain("USDC");
    for (const plan of ["dpp_readiness", "strainchain_passport", "strainchain_farm"] as const) {
      const link = planPaymentLink(plan);
      if (link) expect(priced.result.content[0].text).not.toContain(link);
    }
    expect(priced.result.content[0].text).not.toContain("/api/checkout");

    const tools = (listed.result.tools as Array<{ name: string; description?: string }>);
    for (const t of tools) {
      expect(t.description ?? "", t.name).not.toContain("$0.05");
    }
    expect(tools.find(t => t.name === "get_pricing")?.description).toMatch(/^Free\./);
  });

  it("tools/call dpp_readiness_check is free and scores the answers", async () => {
    const call = (args: Record<string, unknown>) =>
      tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "dpp_readiness_check", arguments: args },
          }),
        })
      );
    const ok = await call({
      category: "battery_passport",
      unique_id: true,
      supplier_data: true,
    });
    expect(ok?.status).toBe(200);
    const body = (await ok!.json()) as {
      result: { content: Array<{ text: string }>; isError?: boolean };
    };
    expect(body.result.isError).toBeUndefined();
    const result = JSON.parse(body.result.content[0].text);
    expect(result.score).toBe(40);
    expect(result.category.date).toBe("2027-02-18");
    expect(result.web).toBe("https://authichain.com/dpp-check");
    expect(result.nextStep).toContain(planPaymentLink("dpp_readiness"));

    const bad = (await (await call({}))!.json()) as {
      result: { isError?: boolean };
    };
    expect(bad.result.isError).toBe(true);
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

  it("uses the seal lookup instead of VERIFY_APP when supabase is set", async () => {
    const orig = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("[]");
    }) as typeof fetch;
    let forwarded = 0;
    try {
      const proof = Buffer.from(
        JSON.stringify({
          scheme: "exact",
          network: "not-a-network",
          payer: "not-an-address",
          amount: "1",
        })
      ).toString("base64");
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", "x-payment": proof },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 11,
            method: "tools/call",
            params: { name: "verify", arguments: { sealId: "probe" } },
          }),
        }),
        {
          X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
        },
        {
          fetch: async () => {
            forwarded += 1;
            return new Response("no");
          },
        }
      );
      expect(res?.status).toBe(402);
      const body = (await res!.json()) as { error?: string };
      expect(body.error).not.toBe("registry_not_bound");
      expect(calls).toEqual([]);
      expect(forwarded).toBe(0);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("query_provenance stays free when a payment header and supabase are present", async () => {
    const orig = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("[]");
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
            id: 12,
            method: "tools/call",
            params: {
              name: "query_provenance",
              arguments: { assetId: "NOPE-XYZ" },
            },
          }),
        }),
        {
          X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
          X402_FACILITATOR_URL: "https://facilitator.example",
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
        }
      );
      expect(res?.status).toBe(200);
      const body = (await res!.json()) as {
        result: { content: Array<{ text: string }> };
      };
      const data = JSON.parse(body.result.content[0].text) as {
        verified: boolean;
      };
      expect(data.verified).toBe(false);
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
    expect(
      await tryHandleMcp(req("https://authichain.com/checkout/dpp_readiness"))
    ).toBeNull();
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
    expect(new URL(seen[0].url).pathname).toBe("/api/v1/agent-verify");
    expect(new URL(seen[0].url).search).toBe("");
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

describe("mcp verify_record (free, open verifier + Polygon read)", () => {
  const hash = anchorJson.recordHash.replace(/^sha256:/, "");
  function rpcStub(input: string, status = "0x1"): typeof fetch {
    return (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { method } = JSON.parse(String(init?.body)) as { method: string };
      const result =
        method === "eth_getTransactionByHash"
          ? { hash: ANCHOR_EXAMPLE_TX, input }
          : { status, blockNumber: "0x5a4b714" };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
    }) as typeof fetch;
  }

  it("is listed as a free tool", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );
    const body = (await res!.json()) as {
      result: { tools: Array<{ name: string; description: string }> };
    };
    const tool = body.result.tools.find(t => t.name === "verify_record");
    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/^Free\./);
    expect(tool!.description).toMatch(/polygon-anchor-1/);
  });

  it("verifies the published record and confirms the hash is in the Polygon tx", async () => {
    const result = await verifyRecordTool(
      { id: "polygon-anchor-1" },
      { fetchImpl: rpcStub("0x" + hash) }
    );
    expect(result).toMatchObject({
      verdict: "verified",
      anchorOnChain: true,
      anchorChainStatus: "tx_contains_record_hash",
      anchorBlock: "0x5a4b714",
      anchorTransaction: ANCHOR_EXAMPLE_TX,
      source: "published_example",
      demonstration: true,
    });
  });

  it("reports the anchor as not on chain when the tx lacks the hash", async () => {
    const result = await verifyRecordTool(
      { id: "polygon-anchor-1" },
      { fetchImpl: rpcStub("0xdeadbeef") }
    );
    expect(result).toMatchObject({
      anchorOnChain: false,
      anchorChainStatus: "hash_not_in_tx",
    });
  });

  it("a submitted record with no anchor is valid-unanchored and makes no RPC call", async () => {
    let called = false;
    const result = await verifyRecordTool(
      { record: recordJson },
      {
        fetchImpl: (async () => {
          called = true;
          throw new Error("no rpc expected");
        }) as typeof fetch,
      }
    );
    expect(result).toMatchObject({
      verdict: "valid-unanchored",
      anchorOnChain: false,
      source: "submitted",
      demonstration: false,
    });
    expect(called).toBe(false);
  });

  it("an unknown id is an error, not a fake verdict", async () => {
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: { name: "verify_record", arguments: { id: "AC-1234ABCD" } },
        }),
      })
    );
    const body = (await res!.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/only published record/);
  });
});
