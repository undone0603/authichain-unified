import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

const message = {
  from: "billing@authichain.com",
  to: "buyer@example.com",
  subject: "Your DPP workspace",
  text: "Activation instructions",
};

function providerResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => "provider response",
  } as Response;
}

describe("transactional email provider fallback policy", () => {
  beforeEach(() => {
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("RESEND_API_KEY", "test-resend-only");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("SENDGRID_API_KEY", "test-sendgrid-only");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([408, 429, 503])(
    "does not fall through to SendGrid after an ambiguous Resend HTTP %i",
    async status => {
      const mockFetch = vi.mocked(globalThis.fetch);
      mockFetch.mockResolvedValueOnce(providerResponse(status));
      const result = await sendEmail(message, { allowFallback: false });

      expect(result).toMatchObject({
        ok: false,
        provider: "resend",
        status,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({ method: "POST" })
      );
    }
  );

  it("does not disguise a definite Resend 401 by trying a second provider", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(providerResponse(401));
    const result = await sendEmail(message, { allowFallback: false });

    expect(result).toMatchObject({
      ok: false,
      provider: "resend",
      status: 401,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("preserves an ambiguous Resend transport exception without trying SendGrid", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockRejectedValueOnce(new Error("connect ETIMEDOUT"));
    await expect(
      sendEmail(message, { allowFallback: false })
    ).rejects.toThrow("ETIMEDOUT");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("preserves existing opt-in fallback behavior for unrelated callers", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch
      .mockResolvedValueOnce(providerResponse(401))
      .mockResolvedValueOnce(providerResponse(202));

    const result = await sendEmail(message);
    expect(result).toMatchObject({
      ok: true,
      provider: "sendgrid",
      status: 202,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1]?.[0]).toBe(
      "https://api.sendgrid.com/v3/mail/send"
    );
  });

  it("never attempts a provider when no credentials are configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SENDGRID_API_KEY", "");
    const mockFetch = vi.mocked(globalThis.fetch);
    const result = await sendEmail(message, { allowFallback: false });
    expect(result).toMatchObject({ ok: false, provider: "none" });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
