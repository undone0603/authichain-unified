import { describe, expect, it, vi } from "vitest";
import {
  STRIPE_CREDIT_IDEMPOTENCY_HEADER,
  STRIPE_CREDIT_RAIL_HEADER,
  STRIPE_CREDIT_RAIL_VALUE,
  parsePrepaidRequest,
  verifyUsingX402StripeCredits,
} from "./x402-agent-pack-verify";
import { X402_AGENT_PACK_PRICE_ID } from "./x402-agent-pack";

const id = "123e4567-e89b-42d3-a456-426614174000";
const apiKeyId = "94e51c84-b504-4625-99f2-7f182c8d88d1";
const userId = "305a82f7-079b-43cb-8294-8656f85287a2";
const env = {
  X402_PACK_PRICE_ID: X402_AGENT_PACK_PRICE_ID,
  X402_PACK_CREDITS: "120",
  X402_PACK_ENABLED: "true",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fake-local-test-token",
};
function req(input: {
  key?: string;
  idem?: string;
  sealId?: string;
  rail?: string;
} = {}) {
  return new Request("https://authichain.com/api/x402", {
    method: "POST",
    headers: {
      [STRIPE_CREDIT_RAIL_HEADER]: input.rail ?? STRIPE_CREDIT_RAIL_VALUE,
      ...(input.key === null ? {} : { "x-api-key": input.key ?? "qron_test_key" }),
      [STRIPE_CREDIT_IDEMPOTENCY_HEADER]: input.idem ?? "test_no_charge_0001",
      "content-type": "application/json",
    },
    body: JSON.stringify({ sealId: input.sealId ?? id }),
  });
}

describe("prepaid Stripe credit rail", () => {
  it("does not accept a missing/ambiguous rail", async () => {
    const result = await verifyUsingX402StripeCredits(
      req({ rail: "x402_usdc" }), env,
      vi.fn() as unknown as typeof fetch
    );
    expect(result.status).toBe(400);
  });

  it("fails closed when the pack switch is off", async () => {
    const fetchSpy = vi.fn();
    const result = await verifyUsingX402StripeCredits(
      req(), { ...env, X402_PACK_ENABLED: "false" },
      fetchSpy as unknown as typeof fetch
    );
    expect(result.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects missing API key, invalid idempotency and invalid seal before any network call", async () => {
    const noKey = new Request("https://authichain.com/api/x402", {
      method: "POST",
      headers: {
        [STRIPE_CREDIT_IDEMPOTENCY_HEADER]: "long_idempotency_key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ sealId: id }),
    });
    expect((await parsePrepaidRequest(noKey)).ok).toBe(false);
    const badIdem = await parsePrepaidRequest(req({ idem: "bad" }));
    expect(badIdem.ok).toBe(false);
    const badSeal = await parsePrepaidRequest(req({ sealId: "not-a-uuid" }));
    expect(badSeal.ok).toBe(false);
  });

  it("does not consume credits when the registry is unavailable", async () => {
    let debits = 0;
    const fake = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api_keys?")) {
        return Response.json([{ id: apiKeyId, user_id: userId, is_active: true, expires_at: null, scopes: ["read"] }]);
      }
      if (url.includes("/auth/v1/admin/users/")) return Response.json({ id: userId, email: "buyer@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" });
      if (url.includes("/auth_seals?")) return new Response("offline", { status: 503 });
      if (url.includes("/rpc/")) debits++;
      return new Response("unexpected", { status: 500 });
    });
    const response = await verifyUsingX402StripeCredits(req(), env, fake as unknown as typeof fetch);
    expect(response.status).toBe(503);
    expect(debits).toBe(0);
  });

  it("rejects an unconfirmed buyer without spending a credit", async () => {
    let debits = 0;
    const fake = vi.fn(async (url: string) => {
      if (url.includes("/api_keys?")) return Response.json([
        { id: apiKeyId, user_id: userId, is_active: true, expires_at: null, scopes: ["read"] },
      ]);
      if (url.includes("/auth/v1/admin/users/")) return Response.json({
        id: userId, email: "mutable@example.com", email_confirmed_at: null,
      });
      if (url.includes("/rpc/")) debits++;
      return Response.json([]);
    });
    const result = await verifyUsingX402StripeCredits(req(), env, fake as unknown as typeof fetch);
    expect(result.status).toBe(403);
    expect(debits).toBe(0);
  });

  it("replayed purchase credit keeps the server-owned balance and never claims on-chain settlement", async () => {
    let rpcRequests = 0;
    const fake = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api_keys?")) return Response.json([
        { id: apiKeyId, user_id: userId, is_active: true, expires_at: null, scopes: ["verify"] },
      ]);
      if (url.includes("/auth/v1/admin/users/")) return Response.json({
        id: userId, email: "buyer@example.com", email_confirmed_at: "2026-01-01T00:00:00Z",
      });
      if (url.includes("/auth_seals?")) return Response.json([]);
      if (url.includes("/rpc/consume_x402_agent_pack_credit")) {
        rpcRequests++;
        expect(init?.method).toBe("POST");
        const payload = JSON.parse(String(init?.body));
        expect(payload.p_idempotency_key).toBe("test_no_charge_0001");
        return Response.json({ allowed: true, replayed: rpcRequests > 1, remaining_credits: 119 });
      }
      return new Response("unexpected", { status: 500 });
    });
    const first = await verifyUsingX402StripeCredits(req(), env, fake as unknown as typeof fetch);
    const replay = await verifyUsingX402StripeCredits(req(), env, fake as unknown as typeof fetch);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    const firstBody = await first.json();
    const replayBody = await replay.json();
    expect(firstBody.billing.replayed).toBe(false);
    expect(replayBody.billing.replayed).toBe(true);
    expect(firstBody.billing.remainingCredits).toBe(119);
    expect(replayBody.billing.remainingCredits).toBe(119);
    expect(replayBody.settlement).toBeUndefined();
    expect(rpcRequests).toBe(2); // every HTTP attempt consults the durable idempotency RPC
  });

  it("returns evidence with Stripe-prepaid accounting and no USDC settlement claim", async () => {
    let debits = 0;
    const fake = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api_keys?")) {
        return Response.json([{ id: apiKeyId, user_id: userId, is_active: true, expires_at: null, scopes: ["verify"] }]);
      }
      if (url.includes("/auth/v1/admin/users/")) return Response.json({ id: userId, email: "buyer@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" });
      if (url.includes("/auth_seals?")) return Response.json([]);
      if (url.includes("/rpc/consume_x402_agent_pack_credit")) {
        debits++;
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.p_api_key_id).toBe(apiKeyId);
        expect(body.p_seal_id).toBe(id);
        expect(body.p_verified_email).toBe("buyer@example.com");
        return Response.json({ allowed: true, replayed: false, remaining_credits: 119 });
      }
      return new Response("unexpected", { status: 500 });
    });
    const response = await verifyUsingX402StripeCredits(req(), env, fake as unknown as typeof fetch);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.billing.rail).toBe("stripe_prepaid");
    expect(body.billing.remainingCredits).toBe(119);
    expect(body.settlement).toBeUndefined();
    expect(body.verified).toBe(false);
    expect(debits).toBe(1);
  });
});
