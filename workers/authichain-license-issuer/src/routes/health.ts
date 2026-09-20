import type { Env } from "../index";

/** Presence only — never include secret values. */
export function describeLicenseBindings(
  env: Partial<Env>
): Record<string, boolean> {
  return {
    DATABASE: Boolean(env.DATABASE),
    SESSIONS: Boolean(env.SESSIONS),
    STRIPE_WEBHOOK_SECRET: Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()),
    STRIPE_SECRET_KEY: Boolean(env.STRIPE_SECRET_KEY?.trim()),
    STRIPE_AGENT_BROWSER_PRO_PRICE_ID: Boolean(
      env.STRIPE_AGENT_BROWSER_PRO_PRICE_ID?.trim()
    ),
    STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID: Boolean(
      env.STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID?.trim()
    ),
    LICENSE_PRIVATE_KEY_PEM: Boolean(env.LICENSE_PRIVATE_KEY_PEM?.trim()),
    LICENSE_PUBLIC_KEY_PEM: Boolean(env.LICENSE_PUBLIC_KEY_PEM?.trim()),
    TELEGRAM_BOT_TOKEN: Boolean(env.TELEGRAM_BOT_TOKEN?.trim()),
    TELEGRAM_ADMIN_CHAT_ID: Boolean(env.TELEGRAM_ADMIN_CHAT_ID?.trim()),
    RESEND_API_KEY: Boolean(env.RESEND_API_KEY?.trim()),
  };
}

export function licenseHealth(
  _request: Request,
  env: Env,
  _ctx: ExecutionContext
): Response {
  const bindings = describeLicenseBindings(env);
  const ready =
    bindings.DATABASE &&
    bindings.STRIPE_WEBHOOK_SECRET &&
    bindings.LICENSE_PRIVATE_KEY_PEM;
  return new Response(
    JSON.stringify({
      ok: ready,
      worker: "authichain-license-issuer",
      webhook: "/api/license/stripe-webhook",
      bindings,
      note: ready
        ? "Webhook can write a D1 license when Stripe posts checkout.session.completed."
        : "One or more required bindings are missing. Do not live-charge until STRIPE_WEBHOOK_SECRET, LICENSE_PRIVATE_KEY_PEM, and D1 DATABASE are set. Probe GET /health — never create a Stripe Checkout session from this worker.",
    }),
    {
      status: ready ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}
