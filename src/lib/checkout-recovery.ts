/**
 * Stripe hosted Checkout abandoned-cart recovery.
 *
 * Docs: https://docs.stripe.com/payments/checkout/abandoned-carts
 *
 * New Passport / DPP sessions enable `after_expiration.recovery` so expired
 * Checkout Sessions expose a 30-day recovery URL on
 * `checkout.session.expired`. Promotion codes and promotional consent stay
 * off until the Stripe Promotions terms are accepted for this account.
 */

export const CHECKOUT_RECOVERY_ALLOW_PROMOTION_CODES = false;

export type HostedCheckoutRecoveryParams = {
  after_expiration: {
    recovery: {
      enabled: true;
      allow_promotion_codes: false;
    };
  };
  customer_creation?: "always";
};

export function hostedCheckoutRecoveryParams(
  mode: "payment" | "subscription"
): HostedCheckoutRecoveryParams {
  return {
    after_expiration: {
      recovery: {
        enabled: true,
        allow_promotion_codes: CHECKOUT_RECOVERY_ALLOW_PROMOTION_CODES,
      },
    },
    ...(mode === "payment" ? { customer_creation: "always" as const } : {}),
  };
}

/** Form-urlencoded equivalent for Worker `POST /v1/checkout/sessions`. */
export function applyHostedCheckoutRecovery(
  body: URLSearchParams,
  mode: "payment" | "subscription" = "payment"
): void {
  body.set("after_expiration[recovery][enabled]", "true");
  body.set(
    "after_expiration[recovery][allow_promotion_codes]",
    String(CHECKOUT_RECOVERY_ALLOW_PROMOTION_CODES)
  );
  if (mode === "payment") {
    body.set("customer_creation", "always");
  }
}

export function checkoutRecoveryUrl(session: {
  after_expiration?: {
    recovery?: { url?: string | null } | null;
  } | null;
}): string | null {
  const url = session.after_expiration?.recovery?.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function checkoutSessionEmail(session: {
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: { customer_email?: string } | null;
}): string | null {
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.customer_email ||
    "";
  const trimmed = email.trim();
  return trimmed.includes("@") ? trimmed : null;
}
