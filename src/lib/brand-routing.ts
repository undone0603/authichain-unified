/**
 * Multi-tenant host routing logic.
 *
 * Shared by the Next.js middleware (Host-header dispatch). Kept as pure
 * functions (no next/server imports) so the routing decisions are unit-testable.
 */

export const BRAND_MAP: Record<string, string> = {
  'qron.space': 'qron', 'www.qron.space': 'qron', 'qron.io': 'qron',
  'strainchain.io': 'strainchain', 'www.strainchain.io': 'strainchain',
  'govchain.us': 'govchain', 'www.govchain.us': 'govchain',
  'authichain.com': 'authichain', 'www.authichain.com': 'authichain',
  'app.authichain.com': 'authichain',
};

// Hosts that serve the application shell rather than the marketing landing.
// The "Launch App" CTA and the authichain.com worker both target app.* — at the
// root these must open the dashboard (which auth-gates to /login), NOT the
// /brand/* marketing page. Without this, app.authichain.com loops back to
// marketing and the app is unreachable at its root.
export const APP_HOSTS = new Set<string>(['app.authichain.com']);

/** Normalize a raw Host header to a bare hostname (lowercase, no port). */
export function normalizeHost(host: string): string {
  return host.toLowerCase().split(':')[0];
}

/** Resolve the brand for a host, falling back to 'authichain'. */
export function resolveBrand(host: string): string {
  const h = normalizeHost(host);
  if (BRAND_MAP[h]) return BRAND_MAP[h];
  for (const [k, v] of Object.entries(BRAND_MAP)) {
    if (h.endsWith('.' + k) || h.includes(v)) return v;
  }
  return 'authichain';
}

/**
 * Decide what the root path ("/") should rewrite to for a given host.
 * - App subdomains → the dashboard (auth-gated; bounces to /login).
 * - Marketing hosts → their /brand/<brand> landing page.
 * - Anything else → null (pass through unchanged).
 */
export function resolveRootRewrite(host: string): string | null {
  const h = normalizeHost(host);
  if (APP_HOSTS.has(h)) return '/dashboard';
  if (BRAND_MAP[h]) return `/brand/${resolveBrand(h)}`;
  return null;
}
