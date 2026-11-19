import { describe, expect, it, vi } from "vitest";
import { NEGOTIATE_TOOL, NEGOTIABLE_SERVICES, negotiateQuote } from "./mcp-negotiate";
import { TOOLS, tryHandleMcp } from "./mcp-routes";

const ALL_EIGHT = [
  "get_pricing",
  "verify",
  "query_provenance",
  "verify_attestation",
  "verify_record",
  "dpp_readiness_check",
  "scan_living_qr",
  "negotiate",
];

function request(method: string, path: string, args?: unknown): Request {
  return new Request(`https://authichain.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 42,
      method,
      ...(args !== undefined ? { params: args } : {}),
    }),
  });
}

describe("MCP callable negotiate (quote only)", () => {
  it("advertises exactly eight unique tools and a strict read-only schema", async () => {
    expect(NEGOTIABLE_SERVICES).toHaveLength(7);
    expect(TOOLS.map(t => t.name)).toEqual(ALL_EIGHT);
    expect(new Set(TOOLS.map(t => t.name)).size).toBe(8);
    expect(NEGOTIATE_TOOL.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["service"],
    });
    expect(NEGOTIATE_TOOL.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
    for (const path of ["/mcp", "/api/mcp"]) {
      const response = await tryHandleMcp(request("tools/list", path));
      expect(response?.status).toBe(200);
      const body = (await response!.json()) as {
        result: { tools: Array<{ name: string }> };
      };
      expect(body.result.tools.map(t => t.name)).toEqual(ALL_EIGHT);
    }
  });

  it("returns deterministic, non-binding, zero-price quotes for every free tool", () => {
    for (const service of NEGOTIABLE_SERVICES.filter(name => name !== "verify")) {
      const args = Object.freeze({ service, mode: "quote_only", currency: "USD", max_budget_usd: 0 });
      const quote = negotiateQuote(args);
      expect(quote.isError).toBe(false);
      expect(quote.body).toMatchObject({
        service,
        mode: "quote_only",
        status: "non_binding_quote",
        price_usd: 0,
        binding: false,
        accepted: false,
        payment_authorized: false,
        settled: false,
        side_effects: false,
        requires_separate_approval: false,
        max_budget_usd: 0,
        next_action: "call_named_tool_separately",
      });
      expect(args.service).toBe(service);
    }
  });

  it("does not execute paid verify, settle, call fetch or authorize payment", async () => {
    const appFetch = vi.fn(async () => {
      throw new Error("APP_WORKER must never be used by negotiate");
    });
    const originalFetch = globalThis.fetch;
    const externalFetch = vi.fn(async () => {
      throw new Error("external fetch must never be used by negotiate");
    });
    globalThis.fetch = externalFetch as typeof fetch;
    try {
      const response = await tryHandleMcp(
        request("tools/call", "/mcp", {
          name: "negotiate",
          arguments: { service: "verify", mode: "quote_only", currency: "USD", max_budget_usd: 1 },
        }),
        {
          APP_WORKER: { fetch: appFetch },
          X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
          X402_PAID_VERIFY_PATH: "seal_lookup",
        } as NonNullable<Parameters<typeof tryHandleMcp>[1]>
      );
      expect(response?.status).toBe(200);
      expect(response!.headers.get("PAYMENT-REQUIRED")).toBeNull();
      const json = (await response!.json()) as {
        result: {
          content: Array<{ type: string; text: string }>;
          structuredContent: Record<string, unknown>;
          isError?: boolean;
        };
      };
      const quote = JSON.parse(json.result.content[0].text) as Record<string, unknown>;
      expect(json.result.isError).toBeUndefined();
      expect(json.result.structuredContent).toEqual(quote);
      expect(quote).toMatchObject({
        service: "verify",
        status: "separate_authorization_required",
        price_usd: 0.05,
        price_status: "live_rail_quote",
        within_budget: true,
        x402: {
          x402Version: 2,
          scheme: "exact",
          network: "eip155:8453",
          asset_symbol: "USDC",
          maxAmountRequired: "50000",
          payTo: "0xabc0000000000000000000000000000000000001",
          resource: "https://authichain.com/api/x402",
        },
        next_action: "seek_explicit_payment_authorization_then_call_verify",
        binding: false,
        accepted: false,
        payment_authorized: false,
        settled: false,
        side_effects: false,
        requires_separate_approval: true,
      });
      expect(appFetch).not.toHaveBeenCalled();
      expect(externalFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("adds x402 v2 terms only when rail terms are passed, and flags an under-budget caller", () => {
    const rail = Object.freeze({
      priceUsd: 0.05,
      amountAtomic: "50000",
      payTo: "0xabc0000000000000000000000000000000000001",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      facilitator: null,
      resource: "https://authichain.com/api/x402",
    });
    const under = negotiateQuote({ service: "verify", max_budget_usd: 0.01 }, rail);
    expect(under.isError).toBe(false);
    expect(under.body).toMatchObject({
      price_usd: 0.05,
      within_budget: false,
      next_action: "do_not_pay_budget_below_price",
      payment_authorized: false,
      settled: false,
      side_effects: false,
    });
    expect((under.body.x402 as Record<string, unknown>).facilitator).toBeNull();
    const noBudget = negotiateQuote({ service: "verify" }, rail);
    expect(noBudget.body.within_budget).toBeNull();
    const unbound = negotiateQuote({ service: "verify", max_budget_usd: 1 });
    expect(unbound.body).toMatchObject({ price_usd: null, price_status: "recheck_current_pricing" });
    expect(unbound.body.x402).toBeUndefined();
    const free = negotiateQuote({ service: "verify_record" }, rail);
    expect(free.body).toMatchObject({ price_usd: 0, status: "non_binding_quote" });
    expect(free.body.x402).toBeUndefined();
  });

  it("omits x402 terms over MCP when the paid seal registry is not bound", async () => {
    const response = await tryHandleMcp(
      request("tools/call", "/mcp", { name: "negotiate", arguments: { service: "verify" } }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" } as NonNullable<
        Parameters<typeof tryHandleMcp>[1]
      >
    );
    const json = (await response!.json()) as { result: { structuredContent: Record<string, unknown> } };
    expect(json.result.structuredContent.price_usd).toBeNull();
    expect(json.result.structuredContent.x402).toBeUndefined();
  });

  it("rejects invalid terms and unsafe authorization attempts without side effects", async () => {
    const invalid: Array<[unknown, string]> = [
      [null, "arguments_must_be_object"],
      [[], "arguments_must_be_object"],
      [{}, "unsupported_service"],
      [{ service: "money_transfer" }, "unsupported_service"],
      [{ service: "verify_record", mode: "execute" }, "non_binding_only"],
      [{ service: "verify_record", currency: "EUR" }, "currency_not_supported"],
      [{ service: "verify", max_budget_usd: -1 }, "invalid_budget"],
      [{ service: "verify", max_budget_usd: Number.POSITIVE_INFINITY }, "invalid_budget"],
      [{ service: "verify", max_budget_usd: Number.NaN }, "invalid_budget"],
      [{ service: "verify", max_budget_usd: 1000001 }, "invalid_budget"],
      [{ service: "verify", max_budget_usd: "10" }, "invalid_budget"],
      [{ service: "verify_record", commit: true }, "unsupported_terms"],
      [{ service: "verify_record", payment_token: "secret" }, "unsupported_terms"],
      [JSON.parse('{"service":"verify_record","__proto__":{"admin":true}}'), "unsupported_terms"],
    ];
    for (const [args, expected] of invalid) {
      const quote = negotiateQuote(args);
      expect(quote).toMatchObject({
        isError: true,
        body: {
          status: "rejected",
          error: expected,
          binding: false,
          accepted: false,
          payment_authorized: false,
          settled: false,
          side_effects: false,
        },
      });
    }
    const response = await tryHandleMcp(
      request("tools/call", "/api/mcp", {
        name: "negotiate",
        arguments: { service: "verify", approve_charge: true },
      })
    );
    expect(response?.status).toBe(200);
    const body = (await response!.json()) as {
      result: { isError: boolean; structuredContent: { error: string } };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error).toBe("unsupported_terms");
  });

  it("keeps protocol initialization distinct from commercial negotiation", async () => {
    const response = await tryHandleMcp(
      request("initialize", "/mcp", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "read-only-test", version: "1.0" },
      })
    );
    const body = (await response!.json()) as {
      result: { protocolVersion: string; capabilities: { tools: unknown } };
    };
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.capabilities.tools).toBeDefined();
  });
});
