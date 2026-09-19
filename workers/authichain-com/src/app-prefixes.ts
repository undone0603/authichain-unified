/** Paths the apex landing worker must proxy to APP_WORKER (authichain-edge-router). */
export const APP_PREFIXES = [
  "/dashboard",
  "/api",
  "/verify",
  "/auth",
  "/login",
  "/logout",
  "/signup",
  "/register",
  "/subscriptions",
  "/settings",
  "/onboard",
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
