import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePaidSealVerify } from "./paid-seal-verify";
import fixture from "../../protocol/conformance/fixtures/valid-unanchored.json";
import { verifyRecord } from "../../protocol/verifier.mjs";

// CFA-363: paid paths need a replay store; an in-memory stub for these tests.
function kvStub() {
  const m = new Map<string, string>();
  return {
    get: async (k: string) => m.get(k) ?? null,
    put: async (k: string, v: string) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
  };
}

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const SEAL = "11111111-1111-4111-8111-111111111111";
const PAY_TO = "0xabc0000000000000000000000000000000000001";
const CREDS = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-test",
};

function proof(extra: Record<string, unknown> = {}): string {
  return Buffer.from(
    JSON.stringify({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount: "50000",
      validBefore: String(Math.floor(Date.now() / 1000) + 600),
      ...extra,
    })
  ).toString("base64");
}

function callsOf(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
): { fetchImpl: typeof fetch; calls: Array<{ url: string; method: string }> } {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: (init?.method ?? "GET").toUpperCase() });
    return handler(url, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_NETWORK;
  delete process.env.X402_PAY_TO;
});

describe("resolvePaidSealVerify", () => {
  const bound = {
    hasVerifyApp: true,
    resource: "https://authichain.com/api/x402",
    priceUsd: 0.05,
    payTo: PAY_TO,
    description: "AuthiChain agent verification",
    env: CREDS,
  };

  it("rejects a bad proof before any registry or settle call", async () => {
    const { fetchImpl, calls } = callsOf(() => new Response("[]"));
    const decision = await resolvePaidSealVerify({
      replayStore: kvStub(),
      ...bound,
      proofHeader: proof({
        network: "not-a-network",
        payer: "not-an-address",
        amount: "1",
      }),
      bodyText: JSON.stringify({ sealId: SEAL }),
      fetchImpl,
    });
    expect(decision).toMatchObject({ action: "answer", status: 402 });
    expect(calls).toEqual([]);
  });

  it("settles the stale PayAI listing sample `demo` as missing-seal evidence", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: true, txHash: "0xabc" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        hasVerifyApp: false,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({
          type: "http",
          method: "POST",
          bodyType: "json",
          body: { sealId: "demo" },
        }),
        fetchImpl,
      });
      expect(decision).toMatchObject({
        action: "answer",
        status: 200,
        body: {
          verified: false,
          registered: false,
          subject: "demo",
          baseline: {
            verdict: "unsigned",
            evidence: { record: null },
          },
          settlement: { trustless: true, txHash: "0xabc" },
        },
      });
      expect(calls.some(call => call.url.includes("auth_seals"))).toBe(false);
      expect(calls.some(call => call.url.includes("/settle"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("settles quote-crawler JSON with no sealId as missing-seal evidence", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: true, txHash: "0xabc" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        hasVerifyApp: false,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({
          url: "https://authichain.com/api/v1/agent-verify",
        }),
        fetchImpl,
      });
      expect(decision).toMatchObject({
        action: "answer",
        status: 200,
        body: {
          verified: false,
          registered: false,
          subject: null,
          baseline: {
            verdict: "unsigned",
            evidence: { record: null },
          },
          settlement: { trustless: true, txHash: "0xabc" },
        },
      });
      expect(calls.some(call => call.url.includes("auth_seals"))).toBe(false);
      expect(calls.some(call => call.url.includes("/settle"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects a non-uuid seal before lookup and settlement", async () => {
    const { fetchImpl, calls } = callsOf(() => new Response("[]"));
    const decision = await resolvePaidSealVerify({
      replayStore: kvStub(),
      ...bound,
      proofHeader: proof({ signature: "0xdead" }),
      bodyText: JSON.stringify({ sealId: "probe" }),
      fetchImpl,
    });
    expect(decision).toMatchObject({
      action: "answer",
      status: 400,
      body: { error: "seal_id_not_uuid", settled: false },
    });
    expect(calls).toEqual([]);
  });

  it("fails closed when the spend ledger cannot be read", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("automation_logs")) {
        return new Response("ledger down", { status: 500 });
      }
      throw new Error("registry and settlement must not run");
    });
    const decision = await resolvePaidSealVerify({
      replayStore: kvStub(),
      ...bound,
      proofHeader: proof({ signature: "0xdead" }),
      bodyText: JSON.stringify({ sealId: SEAL }),
      fetchImpl,
    });
    expect(decision).toMatchObject({
      action: "answer",
      status: 503,
      body: { error: "spend_ledger_unavailable", settled: false },
    });
    expect(calls.some(call => call.url.includes("automation_logs"))).toBe(true);
    expect(calls.some(call => call.url.includes("auth_seals"))).toBe(false);
    expect(calls.some(call => call.url.includes("/settle"))).toBe(false);
  });

  it("returns 503 settled false when the registry read fails and does not settle", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("automation_logs")) {
        return new Response("[]", { status: 200 });
      }
      return new Response("down", { status: 500 });
    });
    const decision = await resolvePaidSealVerify({
      replayStore: kvStub(),
      ...bound,
      proofHeader: proof({ signature: "0xdead" }),
      bodyText: JSON.stringify({ sealId: SEAL }),
      fetchImpl,
    });
    expect(decision).toMatchObject({
      action: "answer",
      status: 503,
      body: { error: "registry_unavailable", settled: false },
    });
    expect(calls.some(call => call.url.includes("auth_seals"))).toBe(true);
    expect(calls.some(call => call.url.includes("/settle"))).toBe(false);
  });

  it("reads the seal and then refuses when the facilitator rejects the proof", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: false, error: "bad signature" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({ sealId: SEAL }),
        fetchImpl,
      });
      expect(decision).toMatchObject({ action: "answer", status: 402 });
      const sealAt = calls.findIndex(call => call.url.includes("auth_seals"));
      const settleAt = calls.findIndex(call => call.url.includes("/settle"));
      expect(sealAt).toBeGreaterThanOrEqual(0);
      expect(settleAt).toBeGreaterThan(sealAt);
      if (decision.action === "answer") {
        expect(JSON.stringify(decision.body)).not.toMatch(/"verified":true/);
      }
    } finally {
      globalThis.fetch = original;
    }
  });

  it("settles a v2 PAYMENT-SIGNATURE retry as 200, not a second 402", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: true, transaction: "0xpaid" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const validBefore = String(Math.floor(Date.now() / 1000) + 600);
    const header = Buffer.from(
      JSON.stringify({
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: "eip155:8453",
          amount: "50000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: PAY_TO,
        },
        payload: {
          signature: "0xsig",
          authorization: {
            from: PAYER,
            to: PAY_TO,
            value: "50000",
            validAfter: "0",
            validBefore,
            nonce: "0x" + "ab".repeat(32),
          },
        },
      })
    ).toString("base64");
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        hasVerifyApp: false,
        proofHeader: header,
        bodyText: "{}",
        fetchImpl,
      });
      expect(decision).toMatchObject({
        action: "answer",
        status: 200,
        body: {
          verified: false,
          subject: null,
          baseline: { verdict: "unsigned" },
          settlement: { trustless: true, txHash: "0xpaid" },
        },
      });
      expect(calls.some(call => call.url.endsWith("/settle"))).toBe(true);
      const settleCall = calls.find(call => call.url.endsWith("/settle"));
      expect(settleCall?.method).toBe("POST");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("settles an empty paid body as missing-seal evidence (x402 retry of the 402 challenge)", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: true, txHash: "0xabc" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        hasVerifyApp: false,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: "{}",
        fetchImpl,
      });
      expect(decision).toMatchObject({
        action: "answer",
        status: 200,
        body: {
          verified: false,
          registered: false,
          subject: null,
          baseline: {
            verdict: "unsigned",
            evidence: { record: null },
          },
          settlement: { trustless: true, txHash: "0xabc" },
        },
      });
      const body = decision.action === "answer" ? decision.body : null;
      expect(JSON.stringify(body)).not.toMatch(/"verified":true/);
      expect(calls.some(call => call.url.includes("auth_seals"))).toBe(false);
      expect(calls.some(call => call.url.includes("/settle"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("delivers unsigned missing-seal evidence after trustless settlement", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl, calls } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: true, txHash: "0xabc" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("auth_seals")) {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        hasVerifyApp: false,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({ sealId: SEAL }),
        fetchImpl,
      });
      expect(decision).toMatchObject({
        action: "answer",
        status: 200,
        body: {
          verified: false,
          registered: false,
          subject: SEAL,
          baseline: { verdict: "unsigned", evidence: { record: null } },
          settlement: { trustless: true, txHash: "0xabc" },
        },
      });
      expect(calls.some(call => call.url.includes("/settle"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("delivers expired evidence as invalid after trustless settlement", async () => {
    const { readFileSync } = await import("node:fs");
    const expired = JSON.parse(
      readFileSync("protocol/conformance/fixtures/time-expired.json", "utf8")
    );
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const { fetchImpl } = callsOf(url => {
      if (url.includes("/settle")) {
        return new Response(
          JSON.stringify({ success: true, txHash: "0xabc" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("auth_seals")) {
        return new Response(
          JSON.stringify([
            {
              id: SEAL,
              product_id: "pack",
              batch_id: "b1",
              brand: "acme",
              created_at: "2026-01-01T00:00:00Z",
              qr_payload: JSON.stringify({ record: expired.record }),
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("[]", { status: 200 });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        hasVerifyApp: false,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({ sealId: SEAL }),
        fetchImpl,
      });
      expect(decision.action).toBe("answer");
      if (decision.action !== "answer") return;
      expect(decision.status).toBe(200);
      const body = decision.body as {
        verified: boolean;
        baseline: { verdict: string; reasons: string[] };
      };
      expect(body.verified).toBe(false);
      expect(body.baseline.verdict).toBe("invalid");
      expect(body.baseline.reasons).toContain("expired");
    } finally {
      globalThis.fetch = original;
    }
  });

  it.each(["unsigned", "signed", "tampered"])(
    "delivers reproducible %s evidence after trustless settlement",
    async kind => {
      const record = structuredClone(fixture.record);
      if (kind === "tampered") record.credentialSubject.serial = "FORGED";
      process.env.X402_FACILITATOR_URL = "https://facilitator.example";
      process.env.X402_NETWORK = "base";
      const original = globalThis.fetch;
      const { fetchImpl, calls } = callsOf(url => {
        if (url.includes("/settle")) {
          return new Response(
            JSON.stringify({ success: true, txHash: "0xabc" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }
        if (url.includes("auth_seals")) {
          return new Response(
            JSON.stringify([
              {
                id: SEAL,
                product_id: "pack",
                batch_id: "b1",
                brand: "acme",
                created_at: "2026-01-01T00:00:00Z",
                qr_payload:
                  kind === "unsigned"
                    ? "https://authichain.com/verify"
                    : JSON.stringify({ record }),
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });
      globalThis.fetch = fetchImpl;
      try {
        const decision = await resolvePaidSealVerify({
          replayStore: kvStub(),
          ...bound,
          hasVerifyApp: false,
          proofHeader: proof({ signature: "0xdead" }),
          bodyText: JSON.stringify({ sealId: SEAL }),
          fetchImpl,
        });
        expect(decision.action).toBe("answer");
        if (decision.action !== "answer") return;
        expect(decision.status).toBe(200);
        expect(decision.body).toMatchObject({
          verified: false,
          registered: true,
          status: "registered",
          checks: {
            registry: "found",
            signature: kind === "unsigned" ? "not_checked" : "checked",
          },
          subject: SEAL,
          details: { brand: "acme", productId: "pack" },
          settlement: { payer: PAYER, trustless: true, txHash: "0xabc" },
        });
        const body = decision.body as {
          baseline: {
            verdict: string;
            checkedAt: string;
            evidence: { record: unknown };
          };
        };
        expect(body.baseline.verdict).toBe(
          kind === "unsigned"
            ? "unsigned"
            : kind === "signed"
              ? "valid-unanchored"
              : "invalid"
        );
        if (kind !== "unsigned") {
          expect(body.baseline).toMatchObject(
            verifyRecord(body.baseline.evidence.record, null, {
              now: body.baseline.checkedAt,
            })
          );
        }
        const lookup = calls.find(call => call.url.includes("auth_seals"));
        expect(lookup?.url).toContain("qr_payload");
        expect(
          calls.some(
            call =>
              call.method === "POST" && call.url.includes("automation_logs")
          )
        ).toBe(false);
      } finally {
        globalThis.fetch = original;
      }
    }
  );

  it("refuses dev-mode settlement when NODE_ENV is production", async () => {
    // vi.stubEnv rather than assigning: NODE_ENV is read-only in the Node
    // types, so a direct write is three type errors, and unstubAllEnvs below
    // restores the previous value without a manual save.
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.X402_FACILITATOR_URL;
    try {
      const { fetchImpl, calls } = callsOf(() => new Response("[]"));
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({ sealId: SEAL }),
        fetchImpl,
      });
      expect(decision).toMatchObject({ action: "answer", status: 402 });
      expect(calls.some(call => call.url.includes("/settle"))).toBe(false);
      expect(calls.some(call => call.url.includes("auth_seals"))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("stays unbound without supabase credentials", async () => {
    const { fetchImpl, calls } = callsOf(() => {
      throw new Error("fetch should not run");
    });
    const decision = await resolvePaidSealVerify({
      replayStore: kvStub(),
      ...bound,
      hasVerifyApp: false,
      env: {},
      proofHeader: proof({ signature: "0xdead" }),
      bodyText: JSON.stringify({ sealId: SEAL }),
      fetchImpl,
    });
    expect(decision).toEqual({ action: "unbound" });
    expect(calls).toEqual([]);
  });

  it("forwards when credentials are absent and VERIFY_APP is set", async () => {
    const decision = await resolvePaidSealVerify({
      replayStore: kvStub(),
      ...bound,
      hasVerifyApp: true,
      env: {},
      proofHeader: proof(),
      bodyText: "{}",
    });
    expect(decision).toEqual({ action: "forward" });
  });

  it("keeps the settled answer when the post-settlement spend log aborts", async () => {
    process.env.X402_FACILITATOR_URL = "https://facilitator.example";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    let spendSignal: AbortSignal | undefined;
    const { fetchImpl } = callsOf((url, init) => {
      if (url.includes("/settle"))
        return new Response(
          JSON.stringify({ success: true, txHash: "0xabc" }),
          { status: 200 }
        );
      if (
        url.includes("automation_logs") &&
        (init?.method ?? "GET").toUpperCase() === "POST"
      ) {
        spendSignal = init?.signal ?? undefined;
        throw new DOMException("The operation was aborted", "AbortError");
      }
      if (url.includes("auth_seals"))
        return new Response(
          JSON.stringify([
            {
              id: SEAL,
              product_id: "pack",
              batch_id: "b1",
              brand: "acme",
              created_at: "2026-01-01T00:00:00Z",
            },
          ]),
          { status: 200 }
        );
      return new Response("[]", { status: 200 });
    });
    globalThis.fetch = fetchImpl;
    try {
      const decision = await resolvePaidSealVerify({
        replayStore: kvStub(),
        ...bound,
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-test",
        },
        proofHeader: proof({ signature: "0xdead" }),
        bodyText: JSON.stringify({ sealId: SEAL }),
        fetchImpl,
      });
      expect(decision).toMatchObject({ action: "answer", status: 200 });
      expect(spendSignal).toBeInstanceOf(AbortSignal);
    } finally {
      globalThis.fetch = original;
    }
  });
});
