import { describe, it, expect, afterEach } from "vitest";
import { Hono } from "hono";
import { registerX402Routes } from "./x402-routes";

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";

function app() {
  const hono = new Hono();
  registerX402Routes(hono);
  return hono;
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
    expect(body.resources).toEqual(["https://authichain.govchain.us/api/x402"]);
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
    expect(JSON.stringify(spec)).not.toContain("/api/checkout");
  });

  it("GET /api/x402 is the same health document", async () => {
    const res = await app().request("/api/x402");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; aliases: string[] };
    expect(body.status).toBe("not_configured");
    expect(body.aliases).toContain("/api/x402/health");
  });

  it("GET /api/v1/agent-verify is health, not a 404", async () => {
    const res = await app().request("/api/v1/agent-verify");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; aliases: string[] };
    expect(body.status).toBe("not_configured");
    expect(body.aliases).toContain("/api/v1/agent-verify");
  });
});

describe("POST /api/x402", () => {
  it("returns 503 payments_not_configured when X402_PAY_TO is missing", async () => {
    const res = await app().request("/api/x402", { method: "POST" });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("not_configured");
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
