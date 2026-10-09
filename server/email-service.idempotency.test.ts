import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PM-330 item 3: webhook-triggered emails carry a Resend Idempotency-Key so a
 * Stripe retry can't double-send. Pins the header on both send paths
 * (server/email-service.ts for the edge router, src/lib/email.ts for DPP
 * fulfilment and the Next mirror) and that the key never leaks into the body.
 */

const fetchSpy = vi.fn(
  async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ id: "re_test" }), { status: 200 })
);
vi.stubGlobal("fetch", fetchSpy);

vi.mock("./_core/env", () => ({
  ENV: {
    resendApiKey: "test-key",
    resendFromEmail: "noreply@authichain.com",
    gmailFromEmail: "",
    gmailAppPassword: "",
    suppressionList: "",
  },
}));

const { sendEmail } = await import("./email-service");
const lib = await import("../src/lib/email");
const { stripeEmailIdempotencyKey } =
  await import("../src/lib/stripe-email-idempotency");

function lastHeaders(): Record<string, string> {
  const init = fetchSpy.mock.calls.at(-1)?.[1];
  return (init?.headers ?? {}) as Record<string, string>;
}

function lastBody(): Record<string, unknown> {
  const init = fetchSpy.mock.calls.at(-1)?.[1];
  return JSON.parse(String(init?.body ?? "{}"));
}

beforeEach(() => {
  fetchSpy.mockClear();
  // No send-ledger creds here: these tests pin the Resend header only.
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("stripeEmailIdempotencyKey", () => {
  it("is stable for one event + template and differs per template", () => {
    const a = stripeEmailIdempotencyKey("evt_1", "checkout_recovery_dpp");
    expect(a).toBe(stripeEmailIdempotencyKey("evt_1", "checkout_recovery_dpp"));
    expect(a).not.toBe(stripeEmailIdempotencyKey("evt_1", "welcome"));
    expect(a).not.toBe(
      stripeEmailIdempotencyKey("evt_2", "checkout_recovery_dpp")
    );
  });

  it("stays within Resend's 256-character limit", () => {
    expect(
      stripeEmailIdempotencyKey("evt_" + "x".repeat(400), "t").length
    ).toBe(256);
  });
});

describe("server/email-service sendEmail → Resend", () => {
  it("sends Idempotency-Key when one is given", async () => {
    const key = stripeEmailIdempotencyKey("evt_abc", "subscription_welcome");
    const res = await sendEmail({
      to: "buyer@example.com",
      subject: "s",
      body: "b",
      idempotencyKey: key,
    });
    expect(res.status).toBe("sent");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lastHeaders()["Idempotency-Key"]).toBe(key);
    expect(JSON.stringify(lastBody())).not.toContain(key);
  });

  it("omits the header when no key is given", async () => {
    await sendEmail({ to: "buyer@example.com", subject: "s", body: "b" });
    expect(lastHeaders()["Idempotency-Key"]).toBeUndefined();
  });
});

describe("src/lib/email sendEmail → Resend", () => {
  it("sends Idempotency-Key as a header, not in the JSON body", async () => {
    const prev = { ...process.env };
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.RESEND_API_KEY = "test-key";
    try {
      const key = stripeEmailIdempotencyKey("evt_dpp", "dpp_audit_provisioned");
      const res = await lib.sendEmail({
        to: "buyer@example.com",
        from: "AuthiChain <noreply@authichain.com>",
        subject: "s",
        text: "t",
        idempotencyKey: key,
      });
      expect(res.ok).toBe(true);
      expect(lastHeaders()["Idempotency-Key"]).toBe(key);
      expect(lastBody()).not.toHaveProperty("idempotencyKey");
    } finally {
      process.env = prev;
    }
  });
});
