/**
 * SEO hub routing for estate apex landings.
 *
 * Generated hubs live at `/p/<slug>` (`worker-app/dynamic-pages.ts` looks the
 * slug up in `content/seo/pages.json` before any certificate). Seed pages in
 * that JSON often advertise the same copy at `https://{domain}/{slug}`.
 * authichain.com already proxies `/p`; strainchain.io, qron.space, and
 * govchain.us did not, so both the canonical seed URL and `/p/<slug>` 404'd.
 *
 * This module is a small allow-list — do not import `pages.json` into a
 * landing worker. `authentic-agentic-economy` is a real authichain.com
 * positioning page and must not 301.
 */

/**
 * Protected seed slugs from `scripts/gen-seo-pages.cjs` whose brand-root
 * canonical should 301 to `/p/<slug>`. Keep in sync with that set, minus
 * `authentic-agentic-economy`.
 */
export const SEO_ROOT_REDIRECT_SLUGS = [
  "ai-qr-code-art-generator",
  "anti-counterfeit-qr-verification",
  "battery-passport-due-diligence-requirement",
  "biotrack-integration-blockchain-provenance",
  "blockchain-product-authentication",
  "cannabis-blockchain-provenance",
  "cannabis-coa-verification-blockchain",
  "counterfeit-detection-with-ai",
  "digital-product-passport-access-rights",
  "dispensary-qr-provenance-scanning",
  "dscsa-compliance-blockchain-serialization",
  "editable-qr-code-no-reprint",
  "eu-dpp-compliance-checklist",
  "government-document-verification-blockchain",
  "government-rfp-award-verification-blockchain",
  "living-qr-code-art-generator",
  "metrc-compliance-blockchain",
  "offline-permit-certificate-qr-verification",
  "partner-program",
  "ppwr-digital-labelling-qr-code",
  "sbir-svip-blockchain-document-verification",
  "untp-digital-product-passport",
  "w3c-verifiable-credentials-product-authentication",
  "what-is-a-digital-product-passport",
] as const;

const SEO_ROOT_REDIRECTS = new Set<string>(SEO_ROOT_REDIRECT_SLUGS);

/** True for `/p` and `/p/<serial-or-slug>`. `/pricing` does not match. */
export function isSeoPassportPath(pathname: string): boolean {
  return pathname === "/p" || pathname.startsWith("/p/");
}

function singleSegmentSlug(pathname: string): string | null {
  if (!pathname.startsWith("/")) return null;
  let rest = pathname.slice(1);
  if (rest.endsWith("/")) rest = rest.slice(0, -1);
  if (!rest || rest.includes("/")) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

/**
 * 301 a known seed canonical (`/{slug}`) to `/p/{slug}`.
 * GET/HEAD only. Leaves `/authentic-agentic-economy` to the landing page.
 */
export function tryRedirectSeoRootCanonical(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const slug = singleSegmentSlug(url.pathname);
  if (!slug || !SEO_ROOT_REDIRECTS.has(slug)) return null;
  const dest = new URL(`/p/${slug}${url.search}`, url.origin);
  return Response.redirect(dest.href, 301);
}
