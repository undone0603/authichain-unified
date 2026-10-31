import { NextResponse } from "next/server";
import { constantTimeEqual } from "./admin-key";

/**
 * Gate the Telegram bot webhook to Telegram itself.
 *
 * Telegram echoes the `secret_token` passed to setWebhook in the
 * X-Telegram-Bot-Api-Secret-Token header of every update. Without this check
 * anyone can POST a forged `successful_payment` update and have it recorded as
 * a purchase. Fails CLOSED: with TELEGRAM_WEBHOOK_SECRET unset every update is
 * refused, so the bot stays inactive until the webhook is re-registered with
 * a secret_token.
 */
export function requireTelegramSecret(req: Request): NextResponse | null {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET not configured" },
      { status: 503 }
    );
  }
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!provided || !constantTimeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
