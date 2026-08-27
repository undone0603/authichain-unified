/**
 * route-manifest.ts
 *
 * Task 3.1 of the Cloudflare migration: a typed, reviewable route-ownership
 * manifest. Pure data + one resolver function. Does NOT wire into
 * `worker-app/index.ts` (that happens in Task 3.2) and does NOT implement
 * any handlers (Task 3.3 owns `worker-app/dynamic-pages.ts`).
 *
 * Every incoming path must resolve to exactly one owner:
 *   - "api"          -> worker-app/index.ts API/tRPC/webhook/cron routes
 *   - "dynamic"       -> worker-app/dynamic-pages.ts (Task 3.3)
 *   - "spa"           -> the Vite/wouter SPA shell (authenticated app)
 *   - "marketing"     -> static marketing HTML generated from Next.js (SSG)
 *   - "spa-fallback"  -> unknown/root paths; SPA shell renders and lets
 *                        wouter resolve or 404 (also covers brand `/`, D2)
 */

/**
 * Authenticated-app route prefixes owned by the SPA shell (client/src/App.tsx,
 * wouter). Boundary-aware prefix match: a path matches a prefix `p` iff
 * `path === p` or `path.startsWith(p + "/")`.
 *
 * Derived from client/src/App.tsx's top-level Switch routes, then:
 *  - MINUS the marketing-static collisions resolved SEO-first per D1:
 *    /demo, /pricing, /qr-codes, /supply-chain, /white-label
 *  - MINUS paths owned by the Task 3.3 dynamic handlers (see
 *    DYNAMIC_HANDLER_PATHS below): /grants. (The SPA's own gallery route is
 *    `/qr-gallery`, which is distinct from the marketing/dynamic `/gallery`
 *    and stays SPA-owned.)
 *
 * Deliberately excludes "/" — a bare "/" prefix would swallow every path.
 * Root resolves via the "spa-fallback" branch instead (D2).
 */
export const SPA_OWNED_PREFIXES: string[] = [
  "/admin",
  "/authenticate",
  "/autopilot",
  "/blockchain",
  "/certificate",
  "/certificates",
  "/character",
  "/crm",
  "/dapp",
  "/dashboard",
  "/email-campaigns",
  "/executive-assistant",
  "/gov-onboarding",
  "/growth",
  "/heygen",
  "/investor-portal",
  "/macrohard",
  "/network-stats",
  "/nft",
  "/notifications",
  "/qr-gallery",
  "/referrals",
  "/regulatory-demo",
  "/roi-calculator",
  "/sba-loan",
  "/scheduled-tasks",
  "/service-orders",
  "/services",
  "/storymode",
  "/subscriptions",
  "/whitepapers",
];

/**
 * Exact/prefix paths owned by the Task 3.3 dynamic handlers
 * (worker-app/dynamic-pages.ts). Boundary-aware match, same rule as above:
 * `/reveal/abc` matches the `/reveal` entry.
 */
export const DYNAMIC_HANDLER_PATHS: Set<string> = new Set([
  "/verify",
  "/status",
  "/grants",
  "/gallery",
  "/reveal",
  "/s",
  "/p",
  "/brand/qron/artwork",
]);

/** True iff `pathname` equals `prefix` or is nested under it (`prefix/...`). */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * Resolve which subsystem owns an incoming request path. First-match-wins:
 *   1. `/api/` prefix               -> "api"
 *   2. `/_next/` prefix              -> "marketing" (static passthrough;
 *                                        `_next/static` assets are merged
 *                                        into the single assets directory)
 *   3. DYNAMIC_HANDLER_PATHS (exact or prefix) -> "dynamic"
 *   4. SPA_OWNED_PREFIXES (prefix)   -> "spa"
 *   5. exact match in `marketingRoutes` -> "marketing"
 *   6. else                          -> "spa-fallback"
 */
export function resolveOwner(
  pathname: string,
  marketingRoutes: Set<string>,
): "api" | "dynamic" | "spa" | "marketing" | "spa-fallback" {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api";
  }

  if (pathname === "/_next" || pathname.startsWith("/_next/")) {
    return "marketing";
  }

  for (const dynamicPath of DYNAMIC_HANDLER_PATHS) {
    if (matchesPrefix(pathname, dynamicPath)) {
      return "dynamic";
    }
  }

  for (const prefix of SPA_OWNED_PREFIXES) {
    if (matchesPrefix(pathname, prefix)) {
      return "spa";
    }
  }

  if (marketingRoutes.has(pathname)) {
    return "marketing";
  }

  return "spa-fallback";
}
