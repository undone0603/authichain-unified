/**
 * Request-time Stripe secret key lookup (PM-231).
 *
 * Why this exists: next.config.js used to list STRIPE_SECRET_KEY under
 * `env` with a build-time fallback. Next's `env` option is a compile-time
 * literal replacement, so every `process.env.STRIPE_SECRET_KEY` in the app was
 * rewritten to whatever value the *build* saw. Workers Builds has no Stripe
 * secret, so authichain-app shipped with the placeholder inlined and never
 * read the real `STRIPE_SECRET_KEY` Worker secret.
 *
 * Rules:
 *  - Call getStripeSecretKey() inside the request handler, never at module
 *    scope. OpenNext copies the Worker's string env bindings (secrets
 *    included) into process.env at the start of each request.
 *  - The lookup uses a computed property so no bundler can inline it.
 *  - An unset value or a build placeholder is treated as "not configured" and
 *    callers fail closed (HTTP 500) instead of calling Stripe.
 *  - Never log or return the key.
 */

const STRIPE_SECRET_KEY_NAME = "STRIPE_SECRET_KEY";

/** The value next.config.js used to inline at build time. */
export const STRIPE_BUILD_PLACEHOLDER = "sk_test_build_placeholder";

export const STRIPE_NOT_CONFIGURED_ERROR =
  "Stripe is not configured: STRIPE_SECRET_KEY is unset on this Worker";

/** Returns the trimmed key, or null if it is empty or a build placeholder. */
export function normalizeStripeSecretKey(
  value: string | null | undefined
): string | null {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) return null;
  if (key === STRIPE_BUILD_PLACEHOLDER || key.includes("build_placeholder")) {
    return null;
  }
  return key;
}

/**
 * Reads STRIPE_SECRET_KEY at call time. Prefers an explicit Worker `env`
 * object when the caller has one; otherwise uses the request-scoped
 * process.env that OpenNext populates from the Worker bindings.
 */
export function getStripeSecretKey(
  env?: Record<string, unknown> | null
): string | null {
  const fromEnv = env?.[STRIPE_SECRET_KEY_NAME];
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return normalizeStripeSecretKey(fromEnv);
  }
  const fromProcess =
    typeof process !== "undefined" && process.env
      ? process.env[STRIPE_SECRET_KEY_NAME]
      : undefined;
  return normalizeStripeSecretKey(fromProcess);
}

/** Clear fail-closed response for routes that need Stripe. */
export function stripeNotConfiguredResponse(): Response {
  return Response.json(
    { error: "stripe_not_configured", message: STRIPE_NOT_CONFIGURED_ERROR },
    { status: 500, headers: { "cache-control": "no-store" } }
  );
}
