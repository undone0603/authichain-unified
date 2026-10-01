import { describe, it, expect, afterEach } from "vitest";
import { requireTelegramSecret } from "./telegram-webhook-auth";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/telegram", {
    method: "POST",
    headers,
  });
}

describe("requireTelegramSecret", () => {
  const ORIGINAL = process.env.TELEGRAM_WEBHOOK_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = ORIGINAL;
  });

  it("refuses every update with 503 when no secret is configured", () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = requireTelegramSecret(
      makeRequest({ "x-telegram-bot-api-secret-token": "anything" })
    );
    expect(res?.status).toBe(503);
  });

  it("refuses with 401 when the header is missing", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "tg-secret";
    expect(requireTelegramSecret(makeRequest({}))?.status).toBe(401);
  });

  it("refuses with 401 when the header is wrong", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "tg-secret";
    const res = requireTelegramSecret(
      makeRequest({ "x-telegram-bot-api-secret-token": "tg-secreT" })
    );
    expect(res?.status).toBe(401);
  });

  it("allows the update when the header matches", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "tg-secret";
    const res = requireTelegramSecret(
      makeRequest({ "x-telegram-bot-api-secret-token": "tg-secret" })
    );
    expect(res).toBeNull();
  });
});
