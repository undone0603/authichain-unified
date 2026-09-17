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
  "/.well-known",
] as const;
