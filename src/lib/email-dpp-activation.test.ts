import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

const oldResend = process.env.RESEND_API_KEY;
const oldGmail = process.env.GMAIL_APP_PASSWORD;
const email = {
  to: "buyer@example.test",
  from: "AuthiChain <billing@authichain.com>",
  subject: "Activate your DPP Workspace",
  html: "<p>Activation</p>",
  text: "Activation",
};

afterEach(() => {
  if (oldResend == null) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = oldResend;
  if (oldGmail == null) delete process.env.GMAIL_APP_PASSWORD;
  else process.env.GMAIL_APP_PASSWORD = oldGmail;
  vi.unstubAllGlobals();
});

describe("DPP Resend-only idempotent activation transport", () => {
  it("uses a stable Checkout Session key and records the provider email ID", async () => {
    process.env.RESEND_API_KEY = "synthetic-test-key";
    process.env.GMAIL_APP_PASSWORD = "synthetic-other-provider";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "resend_test_receipt_2482" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendEmail(email, {
      onlyProvider: "resend",
      idempotencyKey: "cs_test_2482_accepted",
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "resend",
      status: 200,
      messageId: "resend_test_receipt_2482",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.headers["Idempotency-Key"]).toBe("cs_test_2482_accepted");
    expect(opts.headers.Authorization).toBe("Bearer synthetic-test-key");
  });

  it("does not mark a 2xx with no provider receipt as accepted", async () => {
    process.env.RESEND_API_KEY = "synthetic-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendEmail(email, {
      onlyProvider: "resend",
      idempotencyKey: "cs_test_2482_unknown",
    });
    expect(result).toMatchObject({
      ok: false,
      provider: "resend",
      status: 202,
      error: "provider email ID missing",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails closed if Resend is missing, even if another provider is present", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.GMAIL_APP_PASSWORD = "synthetic-other-provider";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendEmail(email, {
      onlyProvider: "resend",
      idempotencyKey: "cs_test_2482_no_resend",
    });
    expect(result).toMatchObject({ ok: false, provider: "resend" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
