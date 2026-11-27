import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerNotaryRoutes } from "./notary-routes";
import { l402TestBackend } from "../src/lib/l402-signals";
import { fakeClaimsNamespace } from "./l402-claims.fakes";

const SHA = "a".repeat(64);
const URL_ = "https://app.authichain.com/api/notary";

function app() {
  const hono = new Hono();
  registerNotaryRoutes(hono);
  return hono;
}

function env(extra: Record<string, unknown> = {}) {
  return {
    L402_ROOT_KEY: "c3".repeat(32),
    L402_BACKEND: "test",
    NODE_ENV: "test",
    L402_BTC_USD_CENTS: "9000000",
    L402_CLAIMS: fakeClaimsNamespace(),
    AGENTZ_API_URL: "https://agentz.example.test",
    AGENT_SECRET: "agent-secret-for-tests",
    CF_ACCESS_CLIENT_ID: "cf-id",
    CF_ACCESS_CLIENT_SECRET: "cf-secret",
    ...extra,
  };
}

const post = (e: ReturnType<typeof env>, body: unknown, authorization?: string) =>
  app().request(
    URL_,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: authorization ? { Authorization: authorization } : {},
    },
    e
  );

async function pay(e: ReturnType<typeof env>) {
  const unpaid = await post(e, { sha256: SHA });
  const h = unpaid.headers.get("www-authenticate") ?? "";
  const macaroon = /macaroon="([^"]+)"/.exec(h)?.[1];
  const hash = /invoice="([^"]+)"/.exec(h)?.[1].split(":").pop();
  return { unpaid, authorization: `L402 ${macaroon}:${l402TestBackend().preimageFor(hash!)}`, hash };
}

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/notary", () => {
  it("is off without L402 or without the AgentZ credentials", async () => {
    for (const e of [env({ L402_ROOT_KEY: "" }), env({ AGENT_SECRET: "" }), env({ AGENTZ_API_URL: "http://plain.example" })]) {
      const res = await post(e, { sha256: SHA });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "l402_not_enabled", rail: "lightning" });
    }
  });

  it("refuses a bad hash before minting an invoice", async () => {
    const res = await post(env(), { sha256: "nope" });
    expect(res.status).toBe(400);
    expect(res.headers.get("www-authenticate")).toBeNull();
  });

  it("quotes $0.05 in sats, then stamps once through AgentZ with the operator token", async () => {
    const e = env();
    const agentz = vi.fn(async () => Response.json({ record: { sha256: SHA }, jws: "x.y.z" }));
    vi.stubGlobal("fetch", agentz);
    const { unpaid, authorization, hash } = await pay(e);
    expect(unpaid.status).toBe(402);
    expect(await unpaid.json()).toMatchObject({ error: "payment_required", sats: 56 });

    const paid = await post(e, { sha256: SHA }, authorization);
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({
      record: { sha256: SHA },
      payment: { rail: "lightning", paymentHash: hash, amountMsat: "56000" },
    });
    const [url, init] = agentz.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://agentz.example.test/agentz/notary");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer agent-secret-for-tests",
      "CF-Access-Client-Id": "cf-id",
      "CF-Access-Client-Secret": "cf-secret",
    });
    expect(JSON.parse(String(init.body))).toEqual({ sha256: SHA });

    expect((await post(e, { sha256: SHA }, authorization)).status).toBe(409);
  });

  it("releases the token when AgentZ does not answer, so the same token works on retry", async () => {
    const e = env();
    const { authorization } = await pay(e);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
    const down = await post(e, { sha256: SHA }, authorization);
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ error: "notary_unavailable", retry_with_same_token: true });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ record: { sha256: SHA } })));
    expect((await post(e, { sha256: SHA }, authorization)).status).toBe(200);
  });

  it("does not accept a signals token", async () => {
    const e = env();
    const { l402SignalsConfig, l402ChallengeFor } = await import("../src/lib/l402-signals");
    const ch = await l402ChallengeFor({
      config: l402SignalsConfig(e),
      url: URL_,
      service: "signals",
      capability: "ping",
      priceUsd: 0.01,
    });
    const res = await post(e, { sha256: SHA }, `L402 ${ch!.macaroon}:${l402TestBackend().preimageFor(ch!.paymentHash)}`);
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "l402_wrong_services" });
  });
});
