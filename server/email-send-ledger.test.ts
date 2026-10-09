import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * PM-338 (c): keyed (webhook) emails are claimed once in the email send
 * ledger before any provider runs, so the Gmail fallbacks — which have no
 * Idempotency-Key — cannot send a second copy, and a Resend outage + Gmail
 * fallback + recovered Resend on the retry cannot either. Fake PostgREST
 * ledger, stubbed fetch and nodemailer; nothing leaves the process.
 */

const smtpSend = vi.fn(async () => ({ messageId: "<smtp-1@test>" }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: smtpSend }) },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    resendApiKey: "test-key",
    resendFromEmail: "noreply@example.test",
    gmailFromEmail: "sender@example.test",
    gmailAppPassword: "app-password-test",
    suppressionList: "",
  },
}));

const ledgerRows = new Set<string>();
let ledgerDown = false;
let resendDown = false;
const resendCalls: string[] = [];

const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rest/v1/email_send_ledger")) {
    if (ledgerDown) return new Response("down", { status: 503 });
    if (init?.method === "POST") {
      const { key_hash } = JSON.parse(String(init.body));
      if (ledgerRows.has(key_hash)) return new Response("dup", { status: 409 });
      ledgerRows.add(key_hash);
      return new Response(null, { status: 201 });
    }
    if (init?.method === "DELETE") {
      ledgerRows.delete(url.split("key_hash=eq.")[1]);
      return new Response(null, { status: 204 });
    }
  }
  if (url.startsWith("https://api.resend.com/")) {
    resendCalls.push(url);
    if (resendDown) return new Response("outage", { status: 500 });
    return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
  }
  return new Response("unexpected", { status: 599 });
});

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GMAIL_APP_PASSWORD",
  "GMAIL_USER",
  "RESEND_API_KEY",
  "BREVO_API_KEY",
  "SENDGRID_API_KEY",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.SUPABASE_URL = "https://ledger.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  vi.stubGlobal("fetch", fetchStub);
  ledgerRows.clear();
  ledgerDown = false;
  resendDown = false;
  resendCalls.length = 0;
  smtpSend.mockClear();
  fetchStub.mockClear();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const { sendEmail } = await import("./email-service");
const lib = await import("../src/lib/email");
const { claimEmailSend, emailKeyHash } =
  await import("../src/lib/email-send-ledger");

const KEY = "stripe-evt_ledger-checkout_recovery_subscription";
const input = { to: "buyer@example.test", subject: "s", body: "b" };

describe("email send ledger (claimEmailSend)", () => {
  it("stores only a SHA-256 hash of the key", async () => {
    expect(await claimEmailSend(KEY)).toBe("claimed");
    const [hash] = [...ledgerRows];
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await emailKeyHash(KEY));
    const body = String(fetchStub.mock.calls[0][1]?.body);
    expect(body).not.toContain("evt_ledger");
  });

  it("returns none without a key, duplicate on reuse, unavailable without creds", async () => {
    expect(await claimEmailSend(undefined)).toBe("none");
    expect(await claimEmailSend(KEY)).toBe("claimed");
    expect(await claimEmailSend(KEY)).toBe("duplicate");
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await claimEmailSend("other")).toBe("unavailable");
  });
});

describe("server/email-service sendEmail with a key", () => {
  it("Gmail SMTP fallback sends once; the retry is skipped as duplicate", async () => {
    resendDown = true;
    const first = await sendEmail({ ...input, idempotencyKey: KEY });
    expect(first).toMatchObject({ status: "sent", provider: "gmail-smtp" });
    expect(smtpSend).toHaveBeenCalledTimes(1);

    resendDown = false; // Resend recovered before Stripe's retry
    const retry = await sendEmail({ ...input, idempotencyKey: KEY });
    expect(retry).toMatchObject({
      status: "skipped",
      reason: "duplicate_idempotency_key",
    });
    expect(smtpSend).toHaveBeenCalledTimes(1);
    expect(resendCalls).toHaveLength(1); // only the failed first attempt
  });

  it("skips the Gmail fallback (fail closed) when the ledger is down", async () => {
    ledgerDown = true;
    resendDown = true;
    const res = await sendEmail({ ...input, idempotencyKey: KEY });
    expect(res).toMatchObject({
      status: "skipped",
      reason: "send_ledger_unavailable",
    });
    expect(smtpSend).not.toHaveBeenCalled();
  });

  it("releases the claim when every provider failed, so a retry can send", async () => {
    resendDown = true;
    smtpSend.mockRejectedValueOnce(new Error("smtp down"));
    process.env.GMAIL_FROM_EMAIL = "";
    const first = await sendEmail({ ...input, idempotencyKey: KEY });
    expect(first.status).not.toBe("sent");
    expect(ledgerRows.size).toBe(0);

    resendDown = false;
    const retry = await sendEmail({ ...input, idempotencyKey: KEY });
    expect(retry.status).toBe("sent");
  });

  it("unkeyed sends never touch the ledger", async () => {
    await sendEmail(input);
    expect(
      fetchStub.mock.calls.some(c => String(c[0]).includes("email_send_ledger"))
    ).toBe(false);
  });
});

describe("src/lib/email sendEmail (Gmail first) with a key", () => {
  const args = {
    to: "buyer@example.test",
    from: "AuthiChain <noreply@example.test>",
    subject: "s",
    text: "t",
    idempotencyKey: KEY,
  };

  it("sends via Gmail once; the retry reports duplicate without sending", async () => {
    process.env.GMAIL_APP_PASSWORD = "app-password-test";
    process.env.GMAIL_USER = "sender@example.test";
    expect(await lib.sendEmail(args)).toMatchObject({
      ok: true,
      provider: "gmail",
    });
    expect(await lib.sendEmail(args)).toMatchObject({
      ok: true,
      duplicate: true,
    });
    expect(smtpSend).toHaveBeenCalledTimes(1);
  });

  it("skips Gmail when the ledger is down but Resend (own header) still sends", async () => {
    ledgerDown = true;
    process.env.GMAIL_APP_PASSWORD = "app-password-test";
    process.env.GMAIL_USER = "sender@example.test";
    process.env.RESEND_API_KEY = "test-key";
    expect(await lib.sendEmail(args)).toMatchObject({
      ok: true,
      provider: "resend",
    });
    expect(smtpSend).not.toHaveBeenCalled();
  });
});
