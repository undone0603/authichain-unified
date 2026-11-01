import { afterEach, describe, expect, it, vi } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
} from "../../../src/lib/x402.ts";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  publicKeyFromDidKey,
  sha256Hex,
  signingBytes,
} from "../../../protocol/verifier.mjs";
import {
  ANCHOR_EXAMPLE_TX,
  ANCHOR_WALLET,
  CERT_CONTRACT,
  DEMONSTRATION_RECORD_HASH,
  DEMONSTRATION_SIGNER_DID,
  LATEST_PROTOCOL_VERSION,
  SERVER_VERSION,
  PRODUCTION_ISSUER_DID,
  PRODUCTION_ISSUER_KID,
  RETIRED_ISSUER_DID,
  RETIRED_ISSUER_KID,
  RETIRED_ISSUER_RETIRED_AT,
  RETIRED_OCT31_ISSUER_DID,
  RETIRED_OCT31_ISSUER_KID,
  RETIRED_OCT31_ISSUER_RETIRED_AT,
  isMcpPath,
  scanLivingQr,
  tryHandleMcp,
  verifyRecordTool,
} from "./mcp-routes";
import anchorJson from "../../../protocol/examples/polygon-anchor-1.anchor.json";
import recordJson from "../../../protocol/examples/polygon-anchor-1.record.json";
import serverManifest from "../../../server.json";

// CFA-363: paid paths need a replay store; an in-memory stub for these tests.
function kvStub() {
  const m = new Map<string, string>();
  return {
    get: async (k: string) => m.get(k) ?? null,
    put: async (k: string, v: string) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
  };
}

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
}

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_PAY_TO;
  delete process.env.X402_NETWORK;
  delete process.env.X402_PRICE_USD;
  delete process.env.X402_PAID_VERIFY_PATH;
});

const BOUND_X402 = {
  X402_PAID_VERIFY_PATH: "seal_lookup",
  X402_PAY_TO: X402_PUBLISHED_PAY_TO,
  X402_PRICE_USD: "0.05",
} as const;

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
      for (const plan of [
        "dpp_readiness",
        "strainchain_passport",
        "strainchain_farm",
      ] as const) {
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
      expect.arrayContaining([
        "get_pricing",
        "verify",
        "query_provenance",
        "verify_attestation",
      ])
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
    for (const plan of [
      "dpp_readiness",
      "strainchain_passport",
      "strainchain_farm",
    ] as const) {
      const link = planPaymentLink(plan);
      if (link) expect(priced.result.content[0].text).not.toContain(link);
    }
    expect(priced.result.content[0].text).not.toContain("/api/checkout");

    const tools = listed.result.tools as Array<{
      name: string;
      description?: string;
    }>;
    for (const t of tools) {
      expect(t.description ?? "", t.name).not.toContain("$0.05");
    }
    expect(tools.find(t => t.name === "get_pricing")?.description).toMatch(
      /^Free\./
    );
  });

  it("GET discovery and get_pricing quote the bound $0.05 x402 rail", async () => {
    for (const path of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
      const res = await tryHandleMcp(req(path), { ...BOUND_X402 });
      expect(res, path).not.toBeNull();
      expect(res!.status, path).toBe(200);
      const body = (await res!.json()) as {
        pricing: {
          verify: { price: string; mcpTool: string };
          paidPlans: {
            status: string;
            rail?: string;
            pricePerCall?: { usd: number; atomic: string };
            asset?: string;
            payTo?: string;
            paidVerify?: { bound: boolean; status: string };
            stripe?: { status: string };
          };
          legacySealVerify: { status: string; bound?: boolean };
          humanCheckout?: unknown;
        };
        tools: Array<{ name: string; description?: string }>;
      };
      expect(body.pricing.verify.price, path).toBe("free");
      expect(body.pricing.verify.mcpTool, path).toBe("verify_record");
      expect(body.pricing.paidPlans.status, path).toBe("live");
      expect(body.pricing.paidPlans.rail, path).toBe("x402");
      expect(body.pricing.paidPlans.pricePerCall?.usd, path).toBe(0.05);
      expect(body.pricing.paidPlans.pricePerCall?.atomic, path).toBe("50000");
      expect(body.pricing.paidPlans.asset?.toLowerCase(), path).toBe(
        BASE_USDC_ASSET.toLowerCase()
      );
      expect(body.pricing.paidPlans.payTo, path).toBe(X402_PUBLISHED_PAY_TO);
      expect(body.pricing.paidPlans.paidVerify?.bound, path).toBe(true);
      expect(body.pricing.paidPlans.paidVerify?.status, path).toBe("bound");
      expect(body.pricing.paidPlans.stripe?.status, path).toBe("on_hold");
      expect(body.pricing.legacySealVerify.status, path).toBe("bound");
      expect(body.pricing.humanCheckout, path).toBeUndefined();
      const text = JSON.stringify(body);
      expect(text, path).toContain("$0.05");
      expect(text, path).toContain("USDC");
      expect(text, path).not.toContain("QRON");
      expect(text, path).not.toContain("/api/checkout");
      for (const plan of [
        "dpp_readiness",
        "strainchain_passport",
        "strainchain_farm",
      ] as const) {
        const link = planPaymentLink(plan);
        if (link) expect(text, path).not.toContain(link);
      }
      expect(
        body.tools.find(t => t.name === "get_pricing")?.description,
        path
      ).toMatch(/\$0\.05 USDC on Base/);
      expect(
        body.tools.find(t => t.name === "verify")?.description,
        path
      ).toMatch(/\$0\.05 USDC on Base/);
    }

    const list = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
      { ...BOUND_X402 }
    );
    const listed = (await list!.json()) as {
      result: { tools: Array<{ name: string; description?: string }> };
    };
    expect(
      listed.result.tools.find(t => t.name === "get_pricing")?.description
    ).toMatch(/\$0\.05 USDC on Base/);

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
      }),
      { ...BOUND_X402 }
    );
    const priced = (await call!.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const pricing = JSON.parse(priced.result.content[0].text) as {
      paidPlans: {
        status: string;
        pricePerCall: { usd: number; atomic: string };
        paidVerify: { bound: boolean; status: string };
        stripe: { status: string };
      };
      legacySealVerify: { status: string; bound: boolean };
    };
    expect(pricing.paidPlans.status).toBe("live");
    expect(pricing.paidPlans.pricePerCall.usd).toBe(0.05);
    expect(pricing.paidPlans.pricePerCall.atomic).toBe("50000");
    expect(pricing.paidPlans.paidVerify.bound).toBe(true);
    expect(pricing.paidPlans.paidVerify.status).toBe("bound");
    expect(pricing.paidPlans.stripe.status).toBe("on_hold");
    expect(pricing.legacySealVerify.status).toBe("bound");
    expect(pricing.legacySealVerify.bound).toBe(true);
    expect(priced.result.content[0].text).toContain("$0.05");
    expect(priced.result.content[0].text).toContain("USDC");
    expect(priced.result.content[0].text).not.toContain("QRON");
    expect(priced.result.content[0].text).not.toContain("/api/checkout");
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
    // Paid plans are on hold: the MCP result names no audit, price or link.
    expect(result.nextStep).not.toContain(planPaymentLink("dpp_readiness"));
    expect(result.nextStep).not.toMatch(/\$\d|audit/i);

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
          params: { name: "verify", arguments: {} },
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

  it("tools/call verify with a non-key argument is 400 and does not ask for payment", async () => {
    for (const args of [
      { serial: "AC-1" },
      { sealId: "demo" },
      { productId: "p-1" },
    ]) {
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 31,
            method: "tools/call",
            params: { name: "verify", arguments: args },
          }),
        }),
        { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" }
      );
      expect(res?.status).toBe(400);
      expect(res!.headers.get("PAYMENT-REQUIRED")).toBeNull();
      const body = (await res!.json()) as { error: string; settled: boolean };
      expect(body.settled).toBe(false);
      expect(["seal_id_required", "seal_id_not_uuid"]).toContain(body.error);
    }
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
          validBefore: String(Math.floor(Date.now() / 1000) + 600),
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
          validBefore: String(Math.floor(Date.now() / 1000) + 600),
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
      // A free provenance lookup may perform a read-only registry lookup, but
      // the payment header must never trigger settlement or spend-ledger writes.
      expect(calls).toHaveLength(2);
      const paths = calls.map(call => new URL(call).pathname);
      expect(paths).toContain("/rest/v1/authichain_attestation_records");
      const registryUrl = new URL(
        calls.find(call => new URL(call).pathname === "/rest/v1/auth_seals")!
      );
      expect(registryUrl.searchParams.get("or")).toContain(
        "product_id.eq.NOPE-XYZ"
      );
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("query_provenance reads auth_seals and never labels registration as verified", async () => {
    const orig = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calls.push(String(input));
      const url = new URL(String(input));
      expect(url.searchParams.get("or")).toContain("product_id.eq.PRODUCT-123");
      expect(init?.method ?? "GET").toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("apikey")).toBe("anon-test");
      expect(headers.get("authorization")).toBe("Bearer anon-test");
      if (url.pathname === "/rest/v1/authichain_attestation_records") {
        expect(url.searchParams.get("published")).toBe("eq.true");
        return new Response("[]", { status: 200 });
      }
      expect(url.pathname).toBe("/rest/v1/auth_seals");
      return new Response(
        JSON.stringify([
          {
            id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
            product_id: "PRODUCT-123",
            batch_id: "batch-2026-A",
            brand: "Example Brand",
            polygon_tx: null,
            created_at: "2026-10-01T12:00:00.000Z",
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }) as typeof fetch;
    try {
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 20,
            method: "tools/call",
            params: {
              name: "query_provenance",
              arguments: { assetId: "PRODUCT-123" },
            },
          }),
        }),
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
        }
      );
      expect(res?.status).toBe(200);
      const body = (await res!.json()) as {
        result: { content: Array<{ text: string }> };
      };
      const data = JSON.parse(body.result.content[0].text) as {
        status: string;
        registered: boolean;
        verified: boolean;
        product: {
          id: string;
          sealId: string;
          batchId: string;
          brand: string;
          source: string;
        };
        registry: { state: string; source: string; semantics: string };
        verification: {
          signature: string;
          revocation: string;
          physicalBinding: string;
        };
      };
      expect(data.status).toBe("registered");
      expect(data.registered).toBe(true);
      expect(data.verified).toBe(false);
      expect(data.product).toMatchObject({
        id: "PRODUCT-123",
        sealId: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
        batchId: "batch-2026-A",
        brand: "Example Brand",
        source: "auth_seals",
      });
      expect(data.registry).toMatchObject({
        state: "available",
        source: "auth_seals",
      });
      expect(data.registry.semantics).toContain("registered only");
      expect(data.verification).toEqual({
        signature: "not_checked",
        revocation: "not_checked",
        physicalBinding: "not_checked",
      });
      expect(calls).toHaveLength(2);
      expect(body.result.content[0].text).not.toContain('"verified": true');
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("query_provenance returns the published JWS but never claims it was verified", async () => {
    const orig = globalThis.fetch;
    const row = {
      attestation_id: "urn:authichain:attestation:v01:SKU-123",
      seal_id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
      product_id: "SKU-123",
      batch_id: "LOT-2026-A",
      brand: "Example Brand",
      object_id: "SKU-123",
      issuer_id: "https://authichain.com",
      issuer_kid: "test-kid",
      decision: "verified",
      payload: { version: "0.1", subject: { object_id: "SKU-123" } },
      jws: "header.payload.signature",
      record_hash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      published_at: "2026-10-16T00:00:00.000Z",
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/rest/v1/authichain_attestation_records");
      expect(url.searchParams.get("published")).toBe("eq.true");
      return new Response(JSON.stringify([row]), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 31,
            method: "tools/call",
            params: {
              name: "query_provenance",
              arguments: { assetId: "SKU-123" },
            },
          }),
        }),
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
        }
      );
      const body = (await res!.json()) as {
        result: { content: Array<{ text: string }> };
      };
      const data = JSON.parse(body.result.content[0].text) as {
        status: string;
        verified: boolean;
        signedRecord: { jws: string; record_hash: string };
        verification: {
          signature: string;
          issuerTrust: string;
          revocation: string;
          physicalBinding: string;
        };
      };
      expect(data.status).toBe("published_attestation");
      expect(data.verified).toBe(false);
      expect(data.signedRecord).toMatchObject({
        jws: row.jws,
        record_hash: row.record_hash,
      });
      expect(data.verification).toEqual({
        signature: "not_checked",
        issuerTrust: "not_checked",
        revocation: "not_checked",
        physicalBinding: "not_checked",
      });
      expect(body.result.content[0].text).not.toContain('"verified": true');
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("verify_attestation calls the canonical verifier and distinguishes signature verification from physical authenticity", async () => {
    const orig = globalThis.fetch;
    const row = {
      attestation_id: "urn:authichain:attestation:v01:SKU-123",
      seal_id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
      product_id: "SKU-123",
      batch_id: "LOT-2026-A",
      brand: "Example Brand",
      object_id: "SKU-123",
      issuer_id: "https://authichain.com",
      issuer_kid: "test-kid",
      decision: "verified",
      payload: { version: "0.1", subject: { object_id: "SKU-123" } },
      jws: "header.payload.signature",
      record_hash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      published_at: "2026-10-16T00:00:00.000Z",
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/rest/v1/authichain_attestation_records");
      return new Response(JSON.stringify([row]), { status: 200 });
    }) as typeof fetch;
    const verifyFetch = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      expect(url.pathname).toBe("/api/v1/attestation/verify");
      const body = (await request.json()) as {
        jws: string;
        expected_object_id?: string;
      };
      expect(body.jws).toBe(row.jws);
      expect(body.expected_object_id).toBe("SKU-123");
      return new Response(
        JSON.stringify({
          valid: true,
          decision: "verified",
          cryptographic_status: "valid",
          issuer_status: "trusted",
          claim_status: "active",
          reasons: [],
        }),
        { status: 200 }
      );
    });
    try {
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 32,
            method: "tools/call",
            params: {
              name: "verify_attestation",
              arguments: { assetId: "SKU-123", expectedObjectId: "SKU-123" },
            },
          }),
        }),
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
          APP_WORKER: { fetch: verifyFetch },
        } as unknown as NonNullable<Parameters<typeof tryHandleMcp>[1]>
      );
      const body = (await res!.json()) as {
        result: { content: Array<{ text: string }>; isError?: boolean };
      };
      const data = JSON.parse(body.result.content[0].text) as {
        verified: boolean;
        status: string;
        physicalBinding: string;
        physical_authenticity: string;
      };
      expect(verifyFetch).toHaveBeenCalledTimes(1);
      expect(data).toMatchObject({
        verified: true,
        status: "verified_signed_claim",
        physicalBinding: "matched_by_canonical_verifier",
        physical_authenticity: "not_proven",
      });
      expect(body.result.isError).toBeUndefined();
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("verify_attestation remains unverified when the canonical verifier binding is missing", async () => {
    const orig = globalThis.fetch;
    const row = {
      attestation_id: "att-123",
      seal_id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
      product_id: "SKU-123",
      issuer_id: "https://authichain.com",
      payload: { subject: { object_id: "SKU-123" } },
      jws: "header.payload.signature",
      record_hash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([row]), { status: 200 })) as typeof fetch;
    try {
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 33,
            method: "tools/call",
            params: {
              name: "verify_attestation",
              arguments: { assetId: "SKU-123" },
            },
          }),
        }),
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
        }
      );
      const body = (await res!.json()) as {
        result: { content: Array<{ text: string }>; isError?: boolean };
      };
      const data = JSON.parse(body.result.content[0].text) as {
        verified: boolean;
        status: string;
      };
      expect(data.verified).toBe(false);
      expect(data.status).toBe("verifier_not_configured");
      expect(body.result.isError).toBe(true);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("does not turn a registry outage into a false not_registered result", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("unavailable", { status: 503 })) as typeof fetch;
    try {
      const res = await tryHandleMcp(
        req("/mcp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 21,
            method: "tools/call",
            params: {
              name: "query_provenance",
              arguments: { assetId: "PRODUCT-123" },
            },
          }),
        }),
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
        }
      );
      const body = (await res!.json()) as {
        result: { content: Array<{ text: string }> };
      };
      const data = JSON.parse(body.result.content[0].text) as {
        status: string;
        verified: boolean;
        registry: { state: string; note: string };
      };
      expect(data.status).toBe("registry_unavailable");
      expect(data.verified).toBe(false);
      expect(data.registry.state).toBe("signed_record_registry_unavailable");
      expect(data.registry.note).toContain(
        "No conclusion about signed-record existence"
      );
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
    expect(data.compliance).not.toMatch(/\$\d/);
    expect(data.compliance).toContain("dpp_readiness_check");
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
      validBefore: String(Math.floor(Date.now() / 1000) + 600),
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
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_REPLAY_KV: kvStub(),
      },
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
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_REPLAY_KV: kvStub(),
      },
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
  function rpcStub(
    input: string,
    status = "0x1",
    from = ANCHOR_WALLET,
    to = ANCHOR_WALLET
  ): typeof fetch {
    return (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { method } = JSON.parse(String(init?.body)) as { method: string };
      const result =
        method === "eth_getTransactionByHash"
          ? { hash: ANCHOR_EXAMPLE_TX, input, from, to }
          : { status, blockNumber: "0x5a4b714" };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
    }) as typeof fetch;
  }
  /** Tx not found (Research's RES-42 forged-record repro). */
  const txMissing = (async () =>
    new Response(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: null })
    )) as typeof fetch;

  /** A record signed by a fresh random Ed25519 key (not allowlisted). */
  function forgedRecord() {
    const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const b58 = (b: Buffer) => {
      let n = BigInt("0x" + (b.toString("hex") || "0"));
      let out = "";
      while (n > 0n) {
        out = B58[Number(n % 58n)] + out;
        n /= 58n;
      }
      for (const x of b) {
        if (x !== 0) break;
        out = "1" + out;
      }
      return out;
    };
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12);
    const did =
      "did:key:z" + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
    const record: Record<string, any> = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://authichain.com/protocol/v1",
      ],
      type: ["VerifiableCredential", "ProvenanceRecord"],
      issuer: did,
      validFrom: "2026-10-01T00:00:00Z",
      credentialSubject: { id: "https://example.test/not-authichain" },
      proof: {
        type: "Ed25519Signature2020",
        created: "2026-10-01T00:00:00Z",
        verificationMethod: did + "#" + did.slice(8),
        proofPurpose: "assertionMethod",
      },
    };
    record.proof.proofValue =
      "z" + b58(sign(null, signingBytes(record), privateKey));
    const recordHash = sha256Hex(signingBytes(record));
    return { record, recordHash, did };
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
      protocolVerdict: "verified",
      reasons: [],
      signer: {
        did: DEMONSTRATION_SIGNER_DID,
        allowlisted: true,
        role: "demonstration",
        kid: null,
        productionIssuer: false,
      },
      anchorOnChain: true,
      anchorChainStatus: "tx_contains_record_hash",
      anchorBlock: "0x5a4b714",
      anchorTransaction: ANCHOR_EXAMPLE_TX,
      source: "published_example",
      demonstration: true,
    });
  });

  it("allowlisted key + a tx that does not carry the hash is not verified", async () => {
    const result = await verifyRecordTool(
      { id: "polygon-anchor-1" },
      { fetchImpl: rpcStub("0xdeadbeef") }
    );
    expect(result).toMatchObject({
      verdict: "unverified",
      protocolVerdict: "verified",
      reasons: ["anchor_not_on_chain:hash_not_in_tx"],
      anchorOnChain: false,
      anchorChainStatus: "hash_not_in_tx",
    });
  });

  it.each([
    ["the cert contract", CERT_CONTRACT],
    ["the anchor wallet", ANCHOR_WALLET],
  ])(
    "third-party wallet anchoring the correct hash to %s is not verified",
    async (_label, to) => {
      const thirdParty = "0x1111111111111111111111111111111111111111";
      const result = await verifyRecordTool(
        { record: recordJson, anchor: anchorJson },
        { fetchImpl: rpcStub("0x" + hash, "0x1", thirdParty, to) }
      );
      expect(result).toMatchObject({
        verdict: "unverified",
        reasons: ["anchor_tx_not_from_anchor_wallet"],
        anchorOnChain: true,
      });
    }
  );

  it("anchor-wallet tx to an unrelated address is not verified", async () => {
    const result = await verifyRecordTool(
      { record: recordJson, anchor: anchorJson },
      {
        fetchImpl: rpcStub(
          "0x" + hash,
          "0x1",
          ANCHOR_WALLET,
          "0x3333333333333333333333333333333333333333"
        ),
      }
    );
    expect(result).toMatchObject({
      verdict: "unverified",
      reasons: ["anchor_tx_not_to_anchor_address"],
    });
  });

  it("demo key is pinned to the published record's hash", () => {
    expect(DEMONSTRATION_RECORD_HASH).toBe(hash);
    expect(sha256Hex(signingBytes(recordJson))).toBe(DEMONSTRATION_RECORD_HASH);
  });

  it("production issuer did:key matches JWKS kid jWTo5QsZ… (RFC 7638)", () => {
    const jwk = publicKeyFromDidKey(PRODUCTION_ISSUER_DID).export({
      format: "jwk",
    }) as { crv: string; kty: string; x: string };
    const thumb = createHash("sha256")
      .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
      .digest("base64url");
    expect(thumb).toBe(PRODUCTION_ISSUER_KID);
    expect(PRODUCTION_ISSUER_KID).toBe(
      "jWTo5QsZfTVi2oQqsfq9E-aSB2XZ0vrXmfE3h0amEDM"
    );
    expect(jwk.x).toBe("MCKE_tTFsmcYVr2PTJgo8X2F3gJTXXrwZev_1UtE5Nk");
  });

  it("retired issuer did:key matches its RFC 7638 kid lue84w… (pre-Oct-9 key)", () => {
    const jwk = publicKeyFromDidKey(RETIRED_ISSUER_DID).export({
      format: "jwk",
    }) as { crv: string; kty: string; x: string };
    const thumb = createHash("sha256")
      .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
      .digest("base64url");
    expect(thumb).toBe(RETIRED_ISSUER_KID);
    expect(jwk.x).toBe("mJx2TLqUmUnxAJW_L-EQ1f28M8B6t9x-9VJPjJxbj7k");
    expect(RETIRED_ISSUER_DID).not.toBe(PRODUCTION_ISSUER_DID);
    expect(RETIRED_ISSUER_DID).not.toBe(RETIRED_OCT31_ISSUER_DID);
    expect(RETIRED_ISSUER_RETIRED_AT).toBe("2026-10-09T05:12:01Z");
  });

  it("retired Oct 31 issuer did:key matches its RFC 7638 kid T3AL7c4w…", () => {
    const jwk = publicKeyFromDidKey(RETIRED_OCT31_ISSUER_DID).export({
      format: "jwk",
    }) as { crv: string; kty: string; x: string };
    const thumb = createHash("sha256")
      .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
      .digest("base64url");
    expect(thumb).toBe(RETIRED_OCT31_ISSUER_KID);
    expect(jwk.x).toBe("T36jnq2kRJRxGBhtyGG3PSboG_Vb6f-l8TixLr95vG0");
    expect(RETIRED_OCT31_ISSUER_DID).not.toBe(PRODUCTION_ISSUER_DID);
    expect(RETIRED_OCT31_ISSUER_RETIRED_AT).toBe("2026-10-31T20:38:07Z");
  });

  it("Oct 31 retired issuer is allowlisted only for records issued before the rotation", async () => {
    const vm =
      RETIRED_OCT31_ISSUER_DID + "#" + RETIRED_OCT31_ISSUER_DID.slice(8);
    const mk = (validFrom: string) => ({
      ...forgedRecord().record,
      issuer: RETIRED_OCT31_ISSUER_DID,
      validFrom,
      proof: { ...forgedRecord().record.proof, verificationMethod: vm },
    });
    const before = (await verifyRecordTool({
      record: mk("2026-10-31T20:38:06Z"),
    })) as any;
    expect(before.signer).toMatchObject({
      allowlisted: true,
      role: "retired_issuer",
      productionIssuer: false,
      kid: RETIRED_OCT31_ISSUER_KID,
    });
    const after = (await verifyRecordTool({
      record: mk("2026-10-31T20:38:07Z"),
    })) as any;
    expect(after.signer).toMatchObject({ allowlisted: false, role: null });
  });

  it("retired issuer is allowlisted only for records issued before Oct 9", async () => {
    const vm = RETIRED_ISSUER_DID + "#" + RETIRED_ISSUER_DID.slice(8);
    const mk = (validFrom: string) => ({
      ...forgedRecord().record,
      issuer: RETIRED_ISSUER_DID,
      validFrom,
      proof: { ...forgedRecord().record.proof, verificationMethod: vm },
    });
    const before = (await verifyRecordTool({
      record: mk("2026-10-01T00:00:00Z"),
    })) as any;
    expect(before.signer).toMatchObject({
      allowlisted: true,
      role: "retired_issuer",
      productionIssuer: false,
    });
    const after = (await verifyRecordTool({
      record: mk("2026-10-10T00:00:00Z"),
    })) as any;
    expect(after.signer).toMatchObject({ allowlisted: false, role: null });
  });

  it("RES-42 repro: random key + made-up tx is not verified", async () => {
    const { record, recordHash } = forgedRecord();
    const anchor = {
      recordHash: "sha256:" + recordHash,
      chain: "polygon:137",
      txHash: "0x" + "cd".repeat(32),
    };
    const result = await verifyRecordTool(
      { record, anchor },
      { fetchImpl: txMissing }
    );
    expect(result).toMatchObject({
      verdict: "unverified",
      protocolVerdict: "verified",
      reasons: ["signer_not_allowlisted", "anchor_not_on_chain:tx_missing"],
      signer: { allowlisted: false, role: null },
      anchorOnChain: false,
    });
  });

  it("random key + a real, unrelated AuthiChain tx is not verified", async () => {
    const { record, recordHash } = forgedRecord();
    const anchor = {
      recordHash: "sha256:" + recordHash,
      chain: "polygon:137",
      txHash: ANCHOR_EXAMPLE_TX,
    };
    // The real demo tx: on chain, from the anchor wallet, but it carries the
    // demo record's hash, not this one.
    const result = await verifyRecordTool(
      { record, anchor },
      { fetchImpl: rpcStub("0x" + hash) }
    );
    expect(result).toMatchObject({
      verdict: "unverified",
      reasons: ["signer_not_allowlisted", "anchor_not_on_chain:hash_not_in_tx"],
      anchorOnChain: false,
    });
  });

  it("random key + its own hash-carrying tx is still not verified", async () => {
    const { record, recordHash } = forgedRecord();
    const attacker = "0x2222222222222222222222222222222222222222";
    const anchor = {
      recordHash: "sha256:" + recordHash,
      chain: "polygon:137",
      txHash: "0x" + "ef".repeat(32),
    };
    const result = await verifyRecordTool(
      { record, anchor },
      { fetchImpl: rpcStub("0x" + recordHash, "0x1", attacker, ANCHOR_WALLET) }
    );
    expect(result).toMatchObject({
      verdict: "unverified",
      reasons: ["signer_not_allowlisted", "anchor_tx_not_from_anchor_wallet"],
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

/**
 * Transport conformance. Before this, /mcp answered notifications with a
 * full result object, hardcoded protocolVersion 2024-11-05 into every
 * reply, and had no `ping` — each of which can stall a strict client's
 * handshake.
 */
describe("mcp streamable http conformance", () => {
  function rpc(body: unknown, headers: Record<string, string> = {}) {
    return tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      })
    );
  }

  it("answers a notification with 202 and no body", async () => {
    const res = await rpc({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res!.status).toBe(202);
    expect(await res!.text()).toBe("");
  });

  it("treats any id-less message as a notification", async () => {
    const res = await rpc({ jsonrpc: "2.0", method: "tools/list" });
    expect(res!.status).toBe(202);
  });

  it("still answers a request whose id is literally null", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: null, method: "tools/list" });
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as { result: { tools: unknown[] } };
    expect(body.result.tools.length).toBeGreaterThan(0);
  });

  it("echoes a protocol version it supports", async () => {
    for (const version of ["2024-11-05", "2025-03-26", "2025-06-18"]) {
      const res = await rpc({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: version, capabilities: {} },
      });
      const body = (await res!.json()) as {
        result: { protocolVersion: string; serverInfo: { name: string } };
      };
      expect(body.result.protocolVersion, version).toBe(version);
      expect(body.result.serverInfo.name).toBe("authichain");
    }
  });

  it("falls back to the newest version for an unknown one", async () => {
    const res = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    });
    const body = (await res!.json()) as {
      result: { protocolVersion: string };
    };
    expect(body.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("answers ping with an empty result", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 9, method: "ping" });
    const body = (await res!.json()) as { id: number; result: object };
    expect(body.id).toBe(9);
    expect(body.result).toEqual({});
  });

  it("returns 405 for a GET that wants an SSE stream", async () => {
    const res = await tryHandleMcp(
      req("/mcp", { headers: { Accept: "text/event-stream" } })
    );
    expect(res!.status).toBe(405);
    const body = (await res!.json()) as { error: string };
    expect(body.error).toBe("sse_stream_not_supported");
  });

  it("still serves discovery JSON to a plain GET", async () => {
    const res = await tryHandleMcp(req("/mcp"));
    expect(res!.status).toBe(200);
    expect(((await res!.json()) as { protocol: string }).protocol).toBe("mcp");
  });

  it("preflights the headers a spec client actually sends", async () => {
    const res = await tryHandleMcp(req("/mcp", { method: "OPTIONS" }));
    expect(res!.status).toBe(204);
    const allow = res!.headers.get("Access-Control-Allow-Headers") ?? "";
    for (const h of ["Accept", "MCP-Protocol-Version", "Mcp-Session-Id"]) {
      expect(allow, h).toContain(h);
    }
    expect(res!.headers.get("Access-Control-Expose-Headers")).toContain(
      "MCP-Protocol-Version"
    );
  });

  /**
   * server.json is what the MCP registry publishes. A client that reads
   * the registry and then connects must see the same version in both
   * places; before this they were 1.2.0 and 1.0.0.
   */
  it("reports the same version the registry publishes", async () => {
    expect(SERVER_VERSION).toBe(serverManifest.version);

    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const body = (await res!.json()) as {
      result: { serverInfo: { version: string } };
    };
    expect(body.result.serverInfo.version).toBe(serverManifest.version);
  });

  // PM-395: the registry listing must not say "free" (paid verify is
  // $0.05 over x402) or claim a Polygon anchor. Cuts only, no publish.
  it("keeps the registry description free of 'free' and Polygon claims", () => {
    expect(serverManifest.description).not.toMatch(/\bfree\b/i);
    expect(serverManifest.description).not.toMatch(/polygon|anchor/i);
  });

  it("points the registry remote at the endpoint this module serves", () => {
    const remote = serverManifest.remotes[0];
    expect(remote.type).toBe("streamable-http");
    expect(isMcpPath(new URL(remote.url).pathname)).toBe(true);
  });

  it("completes a full initialize handshake end to end", async () => {
    const init = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {} },
    });
    expect(init!.status).toBe(200);
    expect(init!.headers.get("MCP-Protocol-Version")).toBe(
      LATEST_PROTOCOL_VERSION
    );

    const ack = await rpc({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(ack!.status).toBe(202);

    const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body = (await list!.json()) as {
      result: { tools: { name: string }[] };
    };
    expect(body.result.tools.map(t => t.name)).toContain("verify_record");
    expect(body.result.tools.map(t => t.name)).toContain("scan_living_qr");
  });
});

describe("scan_living_qr", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects an id that is not a stored presentation id without fetching", async () => {
    let called = false;
    const result = await scanLivingQr(
      { object_id: "https://evil.example/qron" },
      async () => {
        called = true;
        throw new Error("should not fetch");
      }
    );
    expect(called).toBe(false);
    expect(result.isError).toBe(true);
    expect(result.body.error).toBe("object_id_invalid");
    expect(result.body.decision_contract).toBe(
      "AuthiChain Verification Decision v1"
    );
  });

  it("returns Decision v1 fields and drops the JWS", async () => {
    globalThis.fetch = (async (url: string) => {
      expect(url).toBe("https://authichain.com/qron/r/qron%3Aurl%3Adeadbeef");
      return new Response(
        JSON.stringify({
          valid: true,
          decision: "verified",
          decision_contract: "AuthiChain Verification Decision v1",
          cryptographic_status: "valid",
          status: "active",
          jws: "header.payload.sig",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: {
            name: "scan_living_qr",
            arguments: { object_id: "qron:url:deadbeef" },
          },
        }),
      })
    );
    expect(res?.status).toBe(200);
    const payload = (await res!.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> };
    };
    expect(payload.result.isError).toBeUndefined();
    const body = JSON.parse(payload.result.content[0].text) as {
      decision: string;
      decision_contract: string;
      http_status: number;
      jws?: string;
    };
    expect(body.decision).toBe("verified");
    expect(body.decision_contract).toBe("AuthiChain Verification Decision v1");
    expect(body.http_status).toBe(200);
    expect(body.jws).toBeUndefined();
    expect(payload.result.content[0].text).not.toContain("header.payload.sig");
  });

  it("scans through the edge service binding instead of a public same-zone fetch", async () => {
    let publicFetch = false;
    globalThis.fetch = (async () => {
      publicFetch = true;
      throw new Error("public fetch");
    }) as typeof fetch;
    let seen = "";
    const res = await tryHandleMcp(
      req("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: {
            name: "scan_living_qr",
            arguments: { object_id: "qron:url:deadbeef" },
          },
        }),
      }),
      {
        APP_WORKER: {
          fetch: async request => {
            seen = request.url;
            return new Response(
              JSON.stringify({
                valid: true,
                decision: "verified",
                decision_contract: "AuthiChain Verification Decision v1",
                cryptographic_status: "valid",
                status: "active",
                jws: "header.payload.sig",
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          },
        },
      }
    );
    expect(publicFetch).toBe(false);
    expect(seen).toBe("https://authichain.com/qron/r/qron%3Aurl%3Adeadbeef");
    const payload = (await res!.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> };
    };
    expect(payload.result.isError).toBeUndefined();
    const body = JSON.parse(payload.result.content[0].text) as {
      decision: string;
    };
    expect(body.decision).toBe("verified");
    expect(payload.result.content[0].text).not.toContain("header.payload.sig");
  });
});
