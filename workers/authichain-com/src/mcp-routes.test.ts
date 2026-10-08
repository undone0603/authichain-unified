import { afterEach, describe, expect, it } from "vitest";
import { planPaymentLink } from "../../../src/lib/plans.ts";
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
  isMcpPath,
  tryHandleMcp,
  verifyRecordTool,
} from "./mcp-routes";
import anchorJson from "../../../protocol/examples/polygon-anchor-1.anchor.json" with { type: "json" };
import recordJson from "../../../protocol/examples/polygon-anchor-1.record.json" with { type: "json" };
import serverManifest from "../../../server.json" with { type: "json" };

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

  it("production issuer did:key matches JWKS kid lue84w… (RFC 7638)", () => {
    const jwk = publicKeyFromDidKey(PRODUCTION_ISSUER_DID).export({
      format: "jwk",
    }) as { crv: string; kty: string; x: string };
    const thumb = createHash("sha256")
      .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
      .digest("base64url");
    expect(thumb).toBe(PRODUCTION_ISSUER_KID);
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
  });
});
