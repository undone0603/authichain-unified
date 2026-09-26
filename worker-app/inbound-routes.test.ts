// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleInbound, type InboundBindings } from "./inbound-routes";
import { svixSignature } from "../server/outreach/svix-verify";

const SECRET = `whsec_${Buffer.from("inbound-test-signing-key-32byte!").toString("base64")}`;
const ENV: InboundBindings = {
  RESEND_INBOUND_WEBHOOK_SECRET: SECRET,
  RESEND_INBOUND_API_KEY: "re_inbound",
  SUPABASE_URL: "https://db.example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};
const NOW = 1_790_000_000_000;

async function signed(event: unknown) {
  const body = JSON.stringify(event);
  const ts = String(Math.floor(NOW / 1000));
  const sig = await svixSignature(SECRET, "msg_1", ts, body);
  return {
    headers: new Headers({
      "svix-id": "msg_1",
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
    }),
    body,
  };
}

function fakeFetch(
  email: Record<string, unknown> | null,
  supabaseStatus = 201
) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.startsWith("https://api.resend.com/emails/receiving/")) {
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer re_inbound"
      );
      return email
        ? new Response(JSON.stringify(email), { status: 200 })
        : new Response("{}", { status: 500 });
    }
    return new Response(null, { status: supabaseStatus });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const RECEIVED = { type: "email.received", data: { email_id: "em_123" } };

describe("POST /api/outreach/inbound", () => {
  it("suppresses the sender of an opt-out reply", async () => {
    const { impl, calls } = fakeFetch({
      from: "Dana <Dana@AcmeLabs.com>",
      subject: "Re: x",
      text: "Please remove me.",
    });
    const r = await handleInbound(await signed(RECEIVED), ENV, impl, NOW);
    expect(r).toEqual({
      status: 200,
      body: { ok: true, action: "suppressed" },
    });
    expect(calls[0]).toBe("https://api.resend.com/emails/receiving/em_123");
    expect(calls[1]).toContain(
      "/rest/v1/guardrail_suppression_list?on_conflict=email"
    );
    const write = (impl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[1][1] as RequestInit;
    expect(JSON.parse(String(write.body))).toEqual({
      email: "dana@acmelabs.com",
      reason: "unsubscribed",
      source: "inbound_reply",
    });
  });

  it("leaves an ordinary reply alone", async () => {
    const { impl, calls } = fakeFetch({
      from: "dana@acmelabs.com",
      subject: "Re: x",
      text: "Can we talk Thursday?\n> Unsubscribe: https://x",
    });
    const r = await handleInbound(await signed(RECEIVED), ENV, impl, NOW);
    expect(r).toEqual({ status: 200, body: { ok: true, action: "none" } });
    expect(calls).toHaveLength(1);
  });

  it("rejects an unsigned or tampered request before fetching anything", async () => {
    const { impl, calls } = fakeFetch({
      from: "a@b.co",
      subject: "unsubscribe",
    });
    const req = await signed(RECEIVED);
    const r = await handleInbound(
      { headers: req.headers, body: req.body.replace("em_123", "em_999") },
      ENV,
      impl,
      NOW
    );
    expect(r.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("ignores other event types", async () => {
    const { impl, calls } = fakeFetch(null);
    const r = await handleInbound(
      await signed({ type: "email.delivered", data: {} }),
      ENV,
      impl,
      NOW
    );
    expect(r).toMatchObject({ status: 200, body: { action: "ignored" } });
    expect(calls).toHaveLength(0);
  });

  it("asks Resend to retry when the message can't be fetched or the write fails", async () => {
    const noFetch = fakeFetch(null);
    expect(
      (await handleInbound(await signed(RECEIVED), ENV, noFetch.impl, NOW))
        .status
    ).toBe(502);
    const noWrite = fakeFetch({ from: "a@b.co", subject: "unsubscribe" }, 500);
    expect(
      (await handleInbound(await signed(RECEIVED), ENV, noWrite.impl, NOW))
        .status
    ).toBe(503);
  });

  it("is 503 until configured", async () => {
    const { impl } = fakeFetch(null);
    const r = await handleInbound(
      await signed(RECEIVED),
      { ...ENV, RESEND_INBOUND_WEBHOOK_SECRET: undefined },
      impl,
      NOW
    );
    expect(r.status).toBe(503);
  });
});
