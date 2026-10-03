/** Paths the apex landing worker must proxy to APP_WORKER (authichain-edge-router). */
export const APP_PREFIXES = [
  "/dashboard",
  "/dapp",
  "/generate",
  "/api",
  "/verify",
  // Public dynamic pages served by worker-app/dynamic-pages.ts. These must
  // cross the apex landing worker; otherwise authichain.com answers them with
  // marketing HTML/404 instead of the canonical dynamic handler.
  "/status",
  "/grants",
  "/gallery",
  "/reveal",
  "/s",
  "/brand/qron/artwork",
  "/landing",
  // Product passport GET /p/<serial> — worker-app/dynamic-pages.ts.
  // Without this prefix the apex answered marketing 404 HTML for /p and /p/*.
  "/p",
  "/auth",
  "/login",
  "/logout",
  "/signup",
  "/register",
  "/subscriptions",
  "/settings",
  "/onboard",
  // Gated confirm page. Belt if tryHandleGatedCheckout is skipped on a stale deploy.
  "/checkout",
  "/admin",
  // Linked from the homepage nav and footer ("Get Started", "Brand
  // Onboarding", "Sign In") and served by worker-app — see
  // worker-app/route-manifest.ts. Without this prefix the apex never
  // proxied it, so the link resolved to the homepage.
  "/authenticate",
  "/.well-known/jwks.json",
  "/protocol",
  "/story",
] as const;
