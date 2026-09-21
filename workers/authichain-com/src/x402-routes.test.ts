import { afterEach, describe, expect, it } from "vitest";
import { tryHandleAppHost, tryHandleX402 } from "./x402-routes";

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.com${path}`, init);
}

function proofHeader(p: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(p)).toString("base64");
}

afterEach(() => {
  delete process.env.X402_FACILITATOR_URL;
  delete process.env.X402_PAY_TO;
  delete process.env.X402_NETWORK;
});

describe("tryHandleX402", () => {
  it("returns null for other API paths so APP_WORKER still owns them", async () => {
    expect(await tryHandleX402(req("/api/checkout/dpp"))).toBeNull();
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
        paid: boolean;
        priceUsd: number | null;
      }>;
    };
    expect(body.protocol).toBe("x402");
    expect(body.payTo).toBe("0xabc0000000000000000000000000000000000001");
    expect(body.pricePerCall.usd).toBe(0.05);
    expect(body.endpoints.some(e => e.paid && e.path === "/api/x402")).toBe(
      true
    );
  });

  it("GET /.well-known/x402.json is the catalog", async () => {
    const res = await tryHandleX402(req("/.well-known/x402.json"));
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as { catalog: string };
    expect(body.catalog).toBe("/api/x402/catalog");
  });

  it("POST /api/x402/catalog is 405", async () => {
    const res = await tryHandleX402(
      req("/api/x402/catalog", { method: "POST" }),
      { X402_PAY_TO: "0xabc0000000000000000000000000000000000001" }
    );
    expect(res!.status).toBe(405);
  });

  it("GET /api/x402 is the same health document", async () => {
    const res = await tryHandleX402(req("/api/x402"));
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as { status: string; aliases: string[] };
    expect(body.status).toBe("not_configured");
    expect(body.aliases).toContain("/api/x402/health");
  });

  it("GET /api/v1/agent-verify is health, not a 404", async () => {
    const res = await tryHandleX402(req("/api/v1/agent-verify"));
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as { status: string };
    expect(body.status).toBe("not_configured");
  });

  it("HEAD /api/x402/health is 204", async () => {
    const res = await tryHandleX402(
      req("/api/x402/health", { method: "HEAD" })
    );
    expect(res!.status).toBe(204);
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
      accepts: Array<{ payTo: string }>;
      extensions?: { bazaar?: { info?: { input?: { method?: string } } } };
    };
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0].payTo).toBe(
      "0xabc0000000000000000000000000000000000001"
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
      accepts: Array<{ amount?: string; network?: string; resource?: string }>;
      extensions?: { bazaar?: unknown };
    };
    expect(v2.x402Version).toBe(2);
    expect(v2.accepts[0].amount).toBe("50000");
    expect(v2.accepts[0].network).toBe("eip155:8453");
    expect(v2.accepts[0].resource).toBeUndefined();
    expect(v2.extensions?.bazaar).toBeTruthy();
  });

  it("refuses a structural proof when no facilitator is configured", async () => {
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
    expect(res!.status).toBe(402);
    const body = (await res!.json()) as { status: string };
    expect(body.status).toBe("not_configured");
  });

  it("reads a v2 PAYMENT-SIGNATURE header the same as X-PAYMENT", async () => {
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
    expect(res!.status).toBe(402);
    const body = (await res!.json()) as { status: string };
    expect(body.status).toBe("not_configured");
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
    expect(tryHandleAppHost(new Request("https://authichain.com/"))).toBeNull();
  });
});
