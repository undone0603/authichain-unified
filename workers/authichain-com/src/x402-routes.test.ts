import { afterEach, describe, expect, it } from "vitest";
import { tryHandleAppHost, tryHandleX402 } from "./x402-routes";

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

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
}

function proofHeader(p: Record<string, unknown>) {
  return Buffer.from(
    JSON.stringify({
      validBefore: String(Math.floor(Date.now() / 1000) + 600),
      ...p,
    })
  ).toString("base64");
}

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_PAY_TO;
  delete process.env.X402_NETWORK;
});

describe("tryHandleX402", () => {
  it("returns null for other API paths so APP_WORKER still owns them", async () => {
    expect(
      await tryHandleX402(req("https://authichain.com/checkout/dpp_readiness"))
    ).toBeNull();
    expect(await tryHandleX402(req("/api/stripe/webhook"))).toBeNull();
    expect(await tryHandleX402(req("/dashboard"))).toBeNull();
  });

  it("GET /api/x402/health is 200 not_configured without a facilitator", async () => {
    const res = await tryHandleX402(req("/api/x402/health"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("cache-control")).toMatch(/no-store/);
    const body = (await res!.json()) as {
      status: string;
      ready: boolean;
      mode: string;
      facilitator: { configured: boolean };
    };
    expect(body.status).toBe("not_configured");
    expect(body.ready).toBe(false);
    expect(body.mode).toBe("not_configured");
    expect(body.facilitator.configured).toBe(false);
  });

  it("GET /api/x402/catalog lists paid endpoints from the same health config", async () => {
    const res = await tryHandleX402(req("/api/x402/catalog"), {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
      X402_PRICE_USD: "0.05",
    });
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      protocol: string;
      payTo: string;
      pricePerCall: { usd: number };
      endpoints: Array<{
        path: string;
        method: string;
        paid: boolean;
        priceUsd: number | null;
      }>;
      humanCheckout: {
        farmUsd: number;
        farmPaymentLink?: string;
        starterPaymentLink?: string;
      };
    };
    expect(body.protocol).toBe("x402");
    expect(body.payTo).toBe("0xabc0000000000000000000000000000000000001");
    expect(body.pricePerCall.usd).toBe(0.05);
    expect(body.endpoints.some(e => e.paid && e.path === "/api/x402")).toBe(
      true
    );
    expect(
      body.endpoints.some(
        e => e.path === "/api/x402" && e.method === "GET" && e.paid
      )
    ).toBe(true);
    expect(
      body.endpoints.some(
        e => e.path === "/api/x402/health" && e.method === "GET" && e.paid
      )
    ).toBe(false);
    expect(body.humanCheckout.farmUsd).toBe(149);
    expect(body.humanCheckout.farmPaymentLink).toBe(
      "https://authichain.com/checkout/strainchain_farm"
    );
    expect(body.humanCheckout.starterPaymentLink).toBe(
      "https://authichain.com/checkout/starter"
    );
  });

  it("GET /api/x402/listing copies payTo from health for PayAPI", async () => {
    const res = await tryHandleX402(req("/api/x402/listing"), {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
      X402_PRICE_USD: "0.05",
    });
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      name: string;
      category: string;
      paidRoute: string;
      wallet: string;
      priceUsd: number;
      endpoints: number;
      tools: number;
      payapi: { form: { wallet: string; paidRoute: string } };
    };
    expect(body.name).toBe("AuthiChain Agent Verify");
    expect(body.category).toBe("Verification");
    expect(body.paidRoute).toBe("https://authichain.com/api/v1/agent-verify");
    expect(body.wallet).toBe("0xabc0000000000000000000000000000000000001");
    expect(body.payapi.form.wallet).toBe(body.wallet);
    expect(body.priceUsd).toBe(0.05);
    expect(body.endpoints).toBe(2);
    expect(body.tools).toBe(3);
    expect(JSON.stringify(body)).not.toContain(
      "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2"
    );
  });

  it("GET /api/x402/growth lists directories and sister aliases", async () => {
    const res = await tryHandleX402(req("/api/x402/growth"), {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
    });
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      listing: string;
      directories: Array<{ id: string }>;
      sisters: Array<{ origin: string }>;
      pack: { wallet: string };
    };
    expect(body.listing).toBe("/api/x402/listing");
    expect(body.directories.some(d => d.id === "payapi")).toBe(true);
    expect(body.sisters.map(s => s.origin)).toEqual(
      expect.arrayContaining([
        "https://authichain.com",
        "https://qron.space",
        "https://strainchain.io",
        "https://govchain.us",
      ])
    );
    expect(body.pack.wallet).toBe("0xabc0000000000000000000000000000000000001");
  });

  it("GET /.well-known/x402.json is the catalog", async () => {
    const res = await tryHandleX402(req("/.well-known/x402.json"));
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as { catalog: string };
    expect(body.catalog).toBe("/api/x402/catalog");
  });

  it("GET /.well-known/x402 is the x402scan fan-out", async () => {
    const res = await tryHandleX402(req("/.well-known/x402"));
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      version: number;
      resources: string[];
      protocol?: string;
    };
    expect(body.version).toBe(1);
    expect(body.resources).toEqual([
      "https://authichain.com/api/v1/agent-verify",
      "https://authichain.com/api/x402",
    ]);
    expect(body.protocol).toBeUndefined();
  });

  it("GET /.well-known/agent-card.json is a 200 A2A card with x402 payment metadata", async () => {
    const env = {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
      X402_PRICE_USD: "0.05",
    };
    for (const path of [
      "/.well-known/agent-card.json",
      "/.well-known/agent.json",
    ]) {
      const res = await tryHandleX402(req(path), env);
      expect(res, path).not.toBeNull();
      expect(res!.status, path).toBe(200);
      const body = (await res!.json()) as {
        name: string;
        description: string;
        skills: Array<{ id: string; tags?: string[] }>;
        x402: { payTo: string; amount: string; scheme: string };
      };
      expect(body.name).toBe("AuthiChain");
      expect(body.description).toContain(
        "A valid signature is not real-world truth"
      );
      expect(body.skills.some(s => s.id === "paid-evidence-check")).toBe(true);
      expect(body.x402.scheme).toBe("exact");
      expect(body.x402.payTo).toBe(env.X402_PAY_TO);
      expect(body.x402.amount).toBe("50000");
      const raw = JSON.stringify(body).toLowerCase();
      expect(raw).not.toContain("authenticityscore");
      expect(raw).not.toContain("erc8004");
      const card = body as unknown as {
        url: string;
        supportedInterfaces: Array<{ protocolBinding: string; url: string }>;
      };
      expect(card.url).toBe("https://authichain.com/api/a2a");
      expect(card.supportedInterfaces[0]).toMatchObject({
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
        url: "https://authichain.com/api/a2a",
      });
    }
  });

  it("POST /api/a2a SendMessage returns a completed task and does not settle", async () => {
    const res = await tryHandleX402(
      req("/api/a2a", {
        method: "POST",
        headers: { "content-type": "application/json", "A2A-Version": "1.0" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "SendMessage",
          params: { message: { parts: [{ text: "evidence" }] } },
        }),
      })
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as {
      result: { task: { status: { state: string }; artifacts: Array<{ parts: Array<{ text: string }> }> } };
    };
    expect(body.result.task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(body.result.task.artifacts[0].parts[0].text).toContain(
      "does not settle"
    );
    expect(JSON.stringify(body)).not.toContain("txHash");
  });

  it("GET /.well-known/lumi-monitor.txt is the Watch-trial domain proof", async () => {
    const res = await tryHandleX402(req("/.well-known/lumi-monitor.txt"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toMatch(/text\/plain/);
    const text = await res!.text();
    expect(text).toContain("lumi-monitor-verify=");
    expect(text).not.toMatch(/authenticityscore/i);
  });

  it("unpaid POST with quote-crawler JSON and no sealId is 402", async () => {
    const res = await tryHandleX402(
      req("/api/v1/agent-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://authichain.com/api/v1/agent-verify",
        }),
      }),
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_PRICE_USD: "0.05",
      }
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(402);
    expect(res!.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("GET /openapi.json declares x-payment-info for POST /api/x402", async () => {
    const res = await tryHandleX402(req("/openapi.json"), {
      X402_PRICE_USD: "0.05",
    });
    expect(res!.status).toBe(200);
    const spec = (await res!.json()) as {
      openapi: string;
      paths: {
        "/api/x402": {
          get?: {
            "x-payment-info": {
              protocols: string[];
            };
          };
          post: {
            "x-payment-info": {
              protocols: string[];
              price: { amount: string };
            };
          };
        };
      };
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/x402"].post["x-payment-info"].protocols).toEqual([
      "x402",
    ]);
    expect(spec.paths["/api/x402"].post["x-payment-info"].price.amount).toBe(
      "0.05"
    );
    expect(spec.paths["/api/x402"].get?.["x-payment-info"]?.protocols).toEqual([
      "x402",
    ]);
    const raw = JSON.stringify(spec);
    expect(raw).toContain("/qron/r/{object_id}");
    expect(raw).toContain("This host verifies the signature");
    expect(raw).toContain("Not an x402 payment endpoint");
    expect(raw).not.toContain("does not verify the signature");
    expect(raw).not.toContain("/api/checkout");
  });

  it("POST /api/x402/catalog is 405", async () => {
    const res = await tryHandleX402(
      req("/api/x402/catalog", { method: "POST" }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" }
    );
    expect(res!.status).toBe(405);
  });

  it("GET /api/x402 is HTTP 402 when unpaid so GET-first crawlers see a paywall", async () => {
    const res = await tryHandleX402(req("/api/x402"), {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
    });
    expect(res!.status).toBe(402);
    const body = (await res!.json()) as {
      x402Version: number;
      accepts: Array<{ payTo: string; amount?: string }>;
    };
    expect(body.x402Version).toBe(2);
    expect(body.accepts[0].payTo).toBe(
      "0xabc0000000000000000000000000000000000001"
    );
    expect(body.accepts[0].amount).toBe("50000");
    expect(res!.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("GET /api/v1/agent-verify is HTTP 402 when unpaid, not a 404", async () => {
    const res = await tryHandleX402(req("/api/v1/agent-verify"), {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
    });
    expect(res!.status).toBe(402);
    const body = (await res!.json()) as { x402Version: number };
    expect(body.x402Version).toBe(2);
  });

  it("GET with a payment proof is not ignored (unbound registry refuses before settle)", async () => {
    const header = proofHeader({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount: "50000",
    });
    const res = await tryHandleX402(
      req("/api/v1/agent-verify", {
        method: "GET",
        headers: { "x-payment": header },
      }),
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_NETWORK: "base",
      }
    );
    expect(res!.status).toBe(503);
    const body = (await res!.json()) as { error: string; settled: boolean };
    expect(body.error).toBe("registry_not_bound");
    expect(body.settled).toBe(false);
  });

  it("GET /api/x402 without payTo is 503, not a free 200", async () => {
    const res = await tryHandleX402(req("/api/x402"));
    expect(res!.status).toBe(503);
    const body = (await res!.json()) as { error: string; health: string };
    expect(body.error).toBe("payments_not_configured");
    expect(body.health).toBe("/api/x402/health");
  });

  it("HEAD /api/x402/health is 204", async () => {
    const res = await tryHandleX402(
      req("/api/x402/health", { method: "HEAD" })
    );
    expect(res!.status).toBe(204);
  });

  it("HEAD /api/x402 is 402 unpaid quote with empty body", async () => {
    const res = await tryHandleX402(req("/api/x402", { method: "HEAD" }), {
      X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
    });
    expect(res!.status).toBe(402);
    expect(await res!.text()).toBe("");
    expect(res!.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("HEAD /api/v1/agent-verify is 402 unpaid quote with empty body", async () => {
    const res = await tryHandleX402(
      req("/api/v1/agent-verify", { method: "HEAD" }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" }
    );
    expect(res!.status).toBe(402);
    expect(await res!.text()).toBe("");
    expect(res!.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("POST /api/x402 is 503 payments_not_configured when payTo is missing", async () => {
    const res = await tryHandleX402(req("/api/x402", { method: "POST" }));
    expect(res!.status).toBe(503);
    const body = (await res!.json()) as { status: string };
    expect(body.status).toBe("not_configured");
  });

  it("POST /api/v1/agent-verify returns HTTP 402 when unpaid", async () => {
    const res = await tryHandleX402(
      req("/api/v1/agent-verify", { method: "POST" }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" }
    );
    expect(res!.status).toBe(402);
    const body = (await res!.json()) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{
        payTo: string;
        amount?: string;
        maxAmountRequired?: string;
        network?: string;
        outputSchema?: { input?: { type?: string; method?: string } };
      }>;
      extensions?: { bazaar?: { info?: { input?: { method?: string } } } };
    };
    expect(body.x402Version).toBe(2);
    expect(body.resource?.url).toContain("/api/v1/agent-verify");
    expect(body.accepts[0].amount).toBe("50000");
    expect(body.accepts[0].maxAmountRequired).toBeUndefined();
    expect(body.accepts[0].network).toBe("eip155:8453");
    expect(body.accepts[0].payTo).toBe(
      "0xabc0000000000000000000000000000000000001"
    );
    expect(body.accepts[0].outputSchema?.input?.type).toBe("http");
    expect(body.accepts[0].outputSchema?.input?.method).toBe("POST");
    expect(
      (
        body.accepts[0].outputSchema as {
          output?: { example?: unknown; verified?: boolean };
        }
      )?.output?.example
    ).toBeUndefined();
    expect(
      (
        body.accepts[0].outputSchema as {
          output?: { verified?: boolean };
        }
      )?.output?.verified
    ).toBe(false);
    expect(JSON.stringify(body.accepts[0].outputSchema)).not.toMatch(
      /authenticityScore/i
    );
    expect(body.extensions?.bazaar?.info?.input?.method).toBe("POST");
    expect(JSON.stringify(body).toLowerCase()).not.toContain(
      "facilitator.payai"
    );
    const required = res!.headers.get("PAYMENT-REQUIRED");
    expect(required).toBeTruthy();
    const v2 = JSON.parse(
      Buffer.from(required!, "base64").toString("utf8")
    ) as {
      x402Version: number;
      accepts: Array<{
        amount?: string;
        network?: string;
        resource?: string;
        outputSchema?: { input?: { type?: string; method?: string } };
      }>;
      extensions?: { bazaar?: unknown };
    };
    expect(v2.x402Version).toBe(2);
    expect(v2.accepts[0].amount).toBe("50000");
    expect(v2.accepts[0].network).toBe("eip155:8453");
    expect(v2.accepts[0].outputSchema?.input?.type).toBe("http");
    expect(v2.accepts[0].outputSchema?.input?.method).toBe("POST");
    expect(v2.accepts[0].resource).toBeUndefined();
    expect(v2.extensions?.bazaar).toBeTruthy();
    expect(body.x402Version).toBe(v2.x402Version);
    expect(body.accepts[0].amount).toBe(v2.accepts[0].amount);
  });

  it("refuses a payment proof with 503 before settlement (no registry bound)", async () => {
    const header = proofHeader({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount: "50000",
    });
    const res = await tryHandleX402(
      req("/api/x402", {
        method: "POST",
        headers: { "x-payment": header, "content-type": "application/json" },
        body: JSON.stringify({ sealId: "seal-1" }),
      }),
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_NETWORK: "base",
      }
    );
    expect(res!.status).toBe(503);
    const body = (await res!.json()) as { error: string; settled: boolean };
    expect(body.error).toBe("registry_not_bound");
    expect(body.settled).toBe(false);
  });

  it("refuses a v2 PAYMENT-SIGNATURE proof the same as X-PAYMENT", async () => {
    const header = proofHeader({
      x402Version: 2,
      accepted: { scheme: "exact", network: "eip155:8453", amount: "50000" },
      payload: {
        signature: "0xabc",
        authorization: { from: PAYER, to: "0xdef", value: "50000" },
      },
    });
    const res = await tryHandleX402(
      req("/api/x402", {
        method: "POST",
        headers: {
          "PAYMENT-SIGNATURE": header,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sealId: "demo" }),
      }),
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_NETWORK: "base",
      }
    );
    expect(res!.status).toBe(503);
    const body = (await res!.json()) as { error: string; settled: boolean };
    expect(body.error).toBe("registry_not_bound");
    expect(body.settled).toBe(false);
  });
});

describe("tryHandleAppHost", () => {
  it("302s app.authichain.com/ to /dashboard", () => {
    const res = tryHandleAppHost(
      new Request("https://app.authichain.com/", {
        headers: { host: "app.authichain.com" },
      })
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(302);
    expect(res!.headers.get("location")).toBe("/dashboard");
  });

  it("does not steal /dashboard on the app host", () => {
    expect(
      tryHandleAppHost(
        new Request("https://app.authichain.com/dashboard", {
          headers: { host: "app.authichain.com" },
        })
      )
    ).toBeNull();
  });

  it("ignores the apex root", () => {
    expect(
      tryHandleAppHost(new Request("https://authichain.govchain.us/"))
    ).toBeNull();
  });
});

describe("POST /api/x402 with the VERIFY_APP binding", () => {
  it("forwards the paid call to the Next registry route and returns its answer", async () => {
    const header = proofHeader({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount: "50000",
    });
    const seen: Request[] = [];
    const verifyApp = {
      fetch: async (r: Request) => {
        seen.push(r);
        return new Response(JSON.stringify({ verified: true }), {
          status: 200,
          headers: { "PAYMENT-RESPONSE": "settled" },
        });
      },
    };
    const res = await tryHandleX402(
      req("/api/x402?x=1", {
        method: "POST",
        headers: { "x-payment": header, "content-type": "application/json" },
        body: JSON.stringify({ sealId: "seal-1" }),
      }),
      {
        X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
        X402_REPLAY_KV: kvStub(),
      },
      verifyApp
    );
    expect(res!.status).toBe(200);
    expect(res!.headers.get("PAYMENT-RESPONSE")).toBe("settled");
    expect(await res!.json()).toEqual({ verified: true });
    expect(seen).toHaveLength(1);
    expect(new URL(seen[0].url).pathname).toBe("/api/v1/agent-verify");
    expect(new URL(seen[0].url).search).toBe("");
    expect(seen[0].method).toBe("POST");
    expect(seen[0].headers.get("x-payment")).toBe(header);
    expect(await seen[0].json()).toEqual({ sealId: "seal-1" });
  });

  it("still answers an unpaid call with the 402 challenge, without forwarding", async () => {
    let calls = 0;
    const res = await tryHandleX402(
      req("/api/v1/agent-verify", { method: "POST" }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" },
      {
        fetch: async () => {
          calls++;
          return new Response(null, { status: 500 });
        },
      }
    );
    expect(res!.status).toBe(402);
    expect(calls).toBe(0);
  });
});

describe("POST /api/x402 with supabase credentials", () => {
  const registryEnv = {
    X402_PAY_TO: "0xabc0000000000000000000000000000000000001",
    X402_NETWORK: "base",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-test",
  };

  it("rejects a structurally invalid proof before fetch or VERIFY_APP", async () => {
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("[]");
    }) as typeof fetch;
    let forwarded = 0;
    try {
      const header = proofHeader({
        scheme: "exact",
        network: "not-a-network",
        payer: "not-an-address",
        amount: "1",
      });
      const res = await tryHandleX402(
        req("/api/x402", {
          method: "POST",
          headers: { "x-payment": header, "content-type": "application/json" },
          body: JSON.stringify({ sealId: "probe" }),
        }),
        registryEnv,
        {
          fetch: async () => {
            forwarded += 1;
            return new Response("no");
          },
        }
      );
      expect(res!.status).toBe(402);
      const body = (await res!.json()) as { error?: string };
      expect(body.error).not.toBe("registry_not_bound");
      expect(calls).toEqual([]);
      expect(forwarded).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});
