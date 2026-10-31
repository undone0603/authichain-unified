import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { registerX402Routes } from "./x402-routes";

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

function app() {
  const hono = new Hono();
  registerX402Routes(hono);
  return hono;
}

function signedHeader(nonce: string) {
  return proofHeader({
    scheme: "exact",
    network: "base",
    payload: {
      signature: "0xsig",
      authorization: {
        from: PAYER,
        value: "50000",
        validBefore: String(Math.floor(Date.now() / 1000) + 600),
        nonce,
      },
    },
  });
}

function proofHeader(p: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(p)).toString("base64");
}

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_PAY_TO;
  delete process.env.X402_NETWORK;
});

describe("GET /api/x402/health", () => {
  it("returns 200 not_configured when the facilitator is unset", async () => {
    const res = await app().request("/api/x402/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = (await res.json()) as {
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

  it("GET /api/x402/listing and /api/x402/growth are not 404", async () => {
    const listing = await app().request("/api/x402/listing");
    expect(listing.status).toBe(200);
    const listingBody = (await listing.json()) as {
      protocol: string;
      listing: string;
    };
    expect(listingBody.protocol).toBe("x402");
    expect(listingBody.listing).toBe("https://authichain.com/api/x402/listing");

    const growth = await app().request("/api/x402/growth");
    expect(growth.status).toBe(200);
    const growthBody = (await growth.json()) as { listing: string };
    expect(growthBody.listing).toBe("/api/x402/listing");
  });

  it("GET /api/x402/catalog lists paid endpoints from the same health config", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    const res = await app().request("/api/x402/catalog");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      protocol: string;
      payTo: string;
      pricePerCall: { usd: number };
    };
    expect(body.protocol).toBe("x402");
    expect(body.payTo).toBe(process.env.X402_PAY_TO);
    expect(body.pricePerCall.usd).toBe(0.05);
  });

  it("GET /.well-known/x402.json is the catalog", async () => {
    const res = await app().request("/.well-known/x402.json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { catalog: string };
    expect(body.catalog).toBe("/api/x402/catalog");
  });

  it("GET /.well-known/x402 is the x402scan fan-out", async () => {
    const res = await app().request("/.well-known/x402");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
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

  it("GET /openapi.json declares x-payment-info for POST /api/x402", async () => {
    const res = await app().request("/openapi.json");
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      openapi: string;
      paths: {
        "/api/x402": {
          post: {
            "x-payment-info": { protocols: string[] };
          };
        };
      };
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/x402"].post["x-payment-info"].protocols).toEqual([
      "x402",
    ]);
    const raw = JSON.stringify(spec);
    expect(raw).toContain("/qron/r/{object_id}");
    expect(raw).toContain("This host verifies the signature");
    expect(raw).not.toContain("does not verify the signature");
    expect(raw).not.toContain("/api/checkout");
  });

  it("GET /api/x402 is HTTP 402 when unpaid so query-string crawlers see a paywall", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    for (const path of ["/api/x402", "/api/x402?url=https://example.com"]) {
      const res = await app().request(path);
      expect(res.status).toBe(402);
      const body = (await res.json()) as {
        x402Version: number;
        accepts: Array<{ payTo: string; amount?: string }>;
      };
      expect(body.x402Version).toBe(2);
      expect(body.accepts[0].payTo).toBe(process.env.X402_PAY_TO);
      expect(body.accepts[0].amount).toBe("50000");
      expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    }
  });

  it("GET /api/v1/agent-verify is HTTP 402 when unpaid, including ?query", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    const res = await app().request("/api/v1/agent-verify?foo=bar");
    expect(res.status).toBe(402);
    const body = (await res.json()) as { x402Version: number };
    expect(body.x402Version).toBe(2);
  });

  it("GET /api/x402 without payTo is 503, not a free 200", async () => {
    const res = await app().request("/api/x402");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; health: string };
    expect(body.error).toBe("payments_not_configured");
    expect(body.health).toBe("/api/x402/health");
  });

  it("HEAD /api/x402 and /api/v1/agent-verify are 402 unpaid quotes with empty bodies", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    for (const path of ["/api/x402", "/api/v1/agent-verify?url=https://x"]) {
      const res = await app().request(path, { method: "HEAD" });
      expect(res.status).toBe(402);
      expect(await res.text()).toBe("");
      expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    }
  });
});

describe("POST /api/x402", () => {
  it("returns 503 payments_not_configured when X402_PAY_TO is missing", async () => {
    const res = await app().request("/api/x402", { method: "POST" });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("not_configured");
  });

  it("returns 402 for quote JSON without sealId and 400 for a non-UUID sealId", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    for (const body of [{ probe: "suggestions" }, { productId: "p-1" }]) {
      const res = await app().request("/api/v1/agent-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(402);
      expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    }
    const bad = await app().request("/api/v1/agent-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sealId: "AC-DEMO-001" }),
    });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("PAYMENT-REQUIRED")).toBeNull();
    const json = (await bad.json()) as { error: string; settled: boolean };
    expect(json.settled).toBe(false);
    expect(json.error).toBe("seal_id_not_uuid");
  });

  it("keeps an empty unpaid POST on the 402 challenge", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    const res = await app().request("/api/v1/agent-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(402);
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  it("returns HTTP 402 requirements when unpaid", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    const res = await app().request("/api/v1/agent-verify", { method: "POST" });
    expect(res.status).toBe(402);
    const body = (await res.json()) as {
      x402Version: number;
      resource?: { url?: string };
      accepts: Array<{
        payTo: string;
        asset: string;
        amount?: string;
        maxAmountRequired?: string;
        network?: string;
        outputSchema?: { input?: { type?: string; method?: string } };
      }>;
      extensions?: { bazaar?: { info?: { input?: { method?: string } } } };
    };
    expect(body.x402Version).toBe(2);
    expect(body.accepts[0].amount).toBe("50000");
    expect(body.accepts[0].maxAmountRequired).toBeUndefined();
    expect(body.accepts[0].network).toBe("eip155:8453");
    expect(body.accepts[0].payTo).toBe(process.env.X402_PAY_TO);
    expect(body.accepts[0].asset).toBe(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    );
    expect(body.accepts[0].outputSchema?.input?.type).toBe("http");
    expect(body.accepts[0].outputSchema?.input?.method).toBe("POST");
    expect(body.extensions?.bazaar?.info?.input?.method).toBe("POST");
    const required = res.headers.get("PAYMENT-REQUIRED");
    expect(required).toBeTruthy();
    const v2 = JSON.parse(
      Buffer.from(required!, "base64").toString("utf8")
    ) as { x402Version: number; accepts: Array<{ amount?: string }> };
    expect(v2.x402Version).toBe(2);
    expect(v2.accepts[0].amount).toBe("50000");
  });

  it("refuses a payment proof with 503 before settlement (no registry bound)", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    process.env.X402_NETWORK = "base";
    const header = proofHeader({
      scheme: "exact",
      network: "base",
      payer: PAYER,
      amount: "50000",
    });
    const res = await app().request("/api/x402", {
      method: "POST",
      headers: { "x-payment": header, "content-type": "application/json" },
      body: JSON.stringify({ sealId: "seal-1" }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; settled: boolean };
    expect(body.error).toBe("registry_not_bound");
    expect(body.settled).toBe(false);
  });
});

describe("POST /api/x402 with the VERIFY_APP binding", () => {
  it("forwards the paid call to the Next registry route", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    process.env.X402_NETWORK = "base";
    const header = signedHeader("0xe0e0");
    const seen: Request[] = [];
    const env = {
      X402_REPLAY_KV: kvStub(),
      VERIFY_APP: {
        fetch: async (r: Request) => {
          seen.push(r);
          return new Response(JSON.stringify({ verified: true }), {
            status: 200,
          });
        },
      },
    };
    const res = await app().request(
      "https://authichain.com/api/x402",
      {
        method: "POST",
        headers: { "x-payment": header, "content-type": "application/json" },
        body: JSON.stringify({ sealId: "seal-1" }),
      },
      env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
    expect(seen[0].url).toBe("https://authichain.com/api/v1/agent-verify");
    expect(seen[0].headers.get("x-payment")).toBe(header);
    expect(await seen[0].json()).toEqual({ sealId: "seal-1" });
  });

  it("answers from supabase instead of forwarding a bad proof", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    process.env.X402_NETWORK = "base";
    const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("[]");
    }) as typeof fetch;
    const seen: Request[] = [];
    try {
      const header = proofHeader({
        scheme: "exact",
        network: "not-a-network",
        payer: "not-an-address",
        amount: "1",
      });
      const res = await app().request(
        "https://authichain.com/api/x402",
        {
          method: "POST",
          headers: { "x-payment": header, "content-type": "application/json" },
          body: JSON.stringify({ sealId: "probe" }),
        },
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-test",
          VERIFY_APP: {
            fetch: async (r: Request) => {
              seen.push(r);
              return new Response("no", { status: 404 });
            },
          },
        }
      );
      expect(res.status).toBe(402);
      const body = (await res.json()) as { error?: string };
      expect(body.error).not.toBe("registry_not_bound");
      expect(calls).toEqual([]);
      expect(seen).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("GET /api/x402/health paidVerify reflects the worker's registry path", () => {
  type H = { paidVerify: { bound: boolean; status: string } };
  const get = async (env?: Record<string, unknown>) =>
    (await (await app().request("/api/x402/health", {}, env)).json()) as H;

  it("is registry_not_bound with no seal lookup and no VERIFY_APP", async () => {
    const body = await get({});
    expect(body.paidVerify.bound).toBe(false);
    expect(body.paidVerify.status).toBe("registry_not_bound");
  });

  it("is bound when VERIFY_APP is a service binding", async () => {
    const body = await get({
      VERIFY_APP: { fetch: async () => new Response("{}") },
    });
    expect(body.paidVerify).toMatchObject({ bound: true, status: "bound" });
  });

  it("is bound when an https SUPABASE_URL and key are set", async () => {
    const body = await get({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test",
    });
    expect(body.paidVerify.bound).toBe(true);
  });

  it("ignores a non-https URL and a VERIFY_APP without fetch", async () => {
    const body = await get({
      SUPABASE_URL: "http://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-test",
      VERIFY_APP: {},
    });
    expect(body.paidVerify.bound).toBe(false);
  });
});

describe("CFA-363/366: edge-router paid forward needs X402_REPLAY_KV", () => {
  it("503 replay_store_unavailable and no forward when unbound", async () => {
    process.env.X402_PAY_TO = "0xabc0000000000000000000000000000000000001";
    process.env.X402_NETWORK = "base";
    const header = signedHeader("0xe0e1");
    let calls = 0;
    const res = await app().request(
      "https://authichain.com/api/x402",
      {
        method: "POST",
        headers: { "x-payment": header, "content-type": "application/json" },
        body: JSON.stringify({ sealId: "seal-1" }),
      },
      {
        VERIFY_APP: {
          fetch: async () => {
            calls++;
            return new Response("{}", { status: 200 });
          },
        },
      }
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: "replay_store_unavailable",
    });
    expect(calls).toBe(0);
  });
});
