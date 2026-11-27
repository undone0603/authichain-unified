import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerX402Routes } from "./x402-routes";
import { l402TestBackend } from "../src/lib/l402-signals";
import { fakeClaimsNamespace } from "./l402-claims.fakes";

function app() {
  const hono = new Hono();
  registerX402Routes(hono);
  return hono;
}

const ROOT_KEY = "a1".repeat(32);
const PAY_TO = "0xabc0000000000000000000000000000000000001";

function l402Env(extra: Record<string, unknown> = {}) {
  return {
    L402_ROOT_KEY: ROOT_KEY,
    L402_BACKEND: "test",
    NODE_ENV: "test",
    L402_BTC_USD_CENTS: "9000000",
    SUPABASE_URL: "https://registry.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-key-for-tests",
    L402_CLAIMS: fakeClaimsNamespace(),
    ...extra,
  };
}

/** Parse `L402 macaroon="…", invoice="…"`. */
function parseChallenge(header: string | null) {
  const m = /^L402 macaroon="([^"]+)", invoice="([^"]+)"$/.exec(header ?? "");
  if (!m) throw new Error(`no L402 challenge in ${header}`);
  const paymentHash = m[2].split(":").pop()!;
  return { macaroon: m[1], invoice: m[2], paymentHash };
}

async function payFor(path: string, env: ReturnType<typeof l402Env>) {
  const unpaid = await app().request(path, { method: "POST", body: "{}" }, env);
  const ch = parseChallenge(unpaid.headers.get("www-authenticate"));
  const preimage = l402TestBackend().preimageFor(ch.paymentHash)!;
  return { unpaid, ch, authorization: `L402 ${ch.macaroon}:${preimage}` };
}

afterEach(() => {
  delete process.env.X402_PAY_TO;
  vi.unstubAllGlobals();
});

describe("L402 off (the production default today)", () => {
  it("leaves the x402 quote untouched: no WWW-Authenticate header", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await app().request("/api/x402?tier=ping", { method: "POST", body: "{}" });
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toBeNull();
    const body = (await res.json()) as { accepts: Array<{ amount?: string; maxAmountRequired?: string }> };
    expect(body.accepts[0].amount ?? body.accepts[0].maxAmountRequired).toBe("10000");
  });

  it("refuses an L402 token with 400 rather than pretending to accept it", async () => {
    const res = await app().request("/api/x402", {
      method: "POST",
      body: "{}",
      headers: { Authorization: `L402 AgEC:${"00".repeat(32)}` },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "l402_not_enabled", rail: "lightning" });
  });

  it("stays off without the L402_CLAIMS Durable Object (no racy fallback)", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const env = l402Env({ L402_CLAIMS: undefined });
    const res = await app().request("/api/x402?tier=ping", { method: "POST", body: "{}" }, env);
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toBeNull();
  });

  it("stays off with L402_BACKEND=test outside a test runtime", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const env = l402Env({ NODE_ENV: "production" });
    const res = await app().request("/api/x402?tier=ping", { method: "POST", body: "{}" }, env);
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toBeNull();
  });
});

describe("L402 on (test backend, no money)", () => {
  it("adds an L402 challenge beside the unchanged x402 quote on POST", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const env = l402Env();
    const { unpaid, ch } = await payFor("/api/x402?tier=ping", env);
    expect(unpaid.status).toBe(402);
    // $0.01 at $90,000/BTC = 12 sats
    expect(ch.invoice).toBe(`test-invoice-not-payable:12000msat:${ch.paymentHash}`);
    const body = (await unpaid.json()) as { accepts: Array<{ amount?: string; maxAmountRequired?: string }> };
    expect(body.accepts[0].amount ?? body.accepts[0].maxAmountRequired).toBe("10000");
  });

  it("never mints an invoice for a GET quote", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const res = await app().request("/api/x402?tier=ping", {}, l402Env());
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toBeNull();
  });

  it("serves the paid tier once, then refuses the same token as a replay", async () => {
    const env = l402Env();
    const { authorization, ch } = await payFor("/api/x402?tier=ping", env);
    const init = { method: "POST", body: "{}", headers: { Authorization: authorization } };
    const paid = await app().request("/api/x402?tier=ping", init, env);
    expect(paid.status).toBe(200);
    const body = (await paid.json()) as { tier?: string; settlement: Record<string, string> };
    expect(body.settlement).toEqual({ rail: "lightning", paymentHash: ch.paymentHash, amountMsat: "12000" });

    const again = await app().request("/api/x402?tier=ping", init, env);
    expect(again.status).toBe(409);
  });

  it("serves one of ten simultaneous redemptions of the same token; the rest are 409", async () => {
    const env = l402Env();
    const { authorization } = await payFor("/api/x402?tier=ping", env);
    const init = { method: "POST", body: "{}", headers: { Authorization: authorization } };
    const statuses = (
      await Promise.all(Array.from({ length: 10 }, () => app().request("/api/x402?tier=ping", init, env)))
    ).map(r => r.status);
    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    expect(statuses.filter(s => s === 409)).toHaveLength(9);
  });

  it("answers 503 without serving when the claims store cannot be reached", async () => {
    const broken = {
      idFromName: (n: string) => n,
      get: () => ({ fetch: async () => { throw new Error("do unavailable"); } }),
    };
    const env = l402Env({ L402_CLAIMS: broken });
    const { authorization } = await payFor("/api/x402?tier=ping", env);
    const res = await app().request(
      "/api/x402?tier=ping",
      { method: "POST", body: "{}", headers: { Authorization: authorization } },
      env
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "l402_claims_unavailable", retry_with_same_token: true });
  });

  it("works without an x402 payTo: the rails are independent", async () => {
    const env = l402Env();
    const { authorization } = await payFor("/api/x402?tier=evidence", { ...env });
    const res = await app().request(
      "/api/x402?tier=evidence",
      { method: "POST", body: "{}", headers: { Authorization: authorization } },
      env
    );
    expect(res.status).toBe(200);
  });

  it("accepts a paid GET too", async () => {
    const env = l402Env();
    const { authorization } = await payFor("/api/x402?tier=verify", env);
    const res = await app().request("/api/x402?tier=verify", { headers: { Authorization: authorization } }, env);
    expect(res.status).toBe(200);
  });

  it("does not let a ping token open the evidence tier, and offers a fresh challenge", async () => {
    process.env.X402_PAY_TO = PAY_TO;
    const env = l402Env();
    const { authorization } = await payFor("/api/x402?tier=ping", env);
    const res = await app().request(
      "/api/x402?tier=evidence",
      { method: "POST", body: "{}", headers: { Authorization: authorization } },
      env
    );
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "l402_wrong_signals_capabilities" });
    expect(parseChallenge(res.headers.get("www-authenticate")).invoice).toMatch(/^test-invoice-not-payable:112000msat:/);
  });

  it("refuses with 503 before spending the token when no registry is bound", async () => {
    const env = l402Env({ SUPABASE_URL: "" });
    const { authorization } = await payFor("/api/x402?tier=ping", env);
    const init = { method: "POST", body: "{}", headers: { Authorization: authorization } };
    const res = await app().request("/api/x402?tier=ping", init, env);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "l402_registry_not_bound" });
  });

  it("releases the token when the registry read fails, so the payer can retry", async () => {
    const env = l402Env();
    const { authorization } = await payFor("/api/x402?tier=ping", env);
    const sealId = "11111111-2222-4333-8444-555555555555";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const init = { method: "POST", body: JSON.stringify({ sealId }), headers: { Authorization: authorization } };
    const failed = await app().request("/api/x402?tier=ping", init, env);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ error: "registry_unavailable", retry_with_same_token: true });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: sealId }])));
    const retry = await app().request("/api/x402?tier=ping", init, env);
    expect(retry.status).toBe(200);
  });
});
