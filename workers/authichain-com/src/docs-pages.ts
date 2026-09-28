/**
 * Wave-1 public docs at /docs and /docs/:slug.
 *
 * Mount only on workers/authichain-com. isX402DocsPath wins, so /docs/x402
 * stays on x402-docs-page.ts. /docs/protocol 301s to /protocol.
 * /docs/dpp and /docs/digital-product-passports 301 to /docs/dpp-architecture.
 * These checks must not swallow /onboard, /verify, /api, /checkout, or /pricing.
 */

export const DOCS_HUB = "/docs" as const;

export const DOCS_PAGES = [
  "gs1-digital-link",
  "verification",
  "dpp-architecture",
  "examples",
] as const;

export type DocsPageSlug = (typeof DOCS_PAGES)[number];

const REDIRECTS: Record<string, string> = {
  "/docs/protocol": "/protocol",
  "/docs/protocol/": "/protocol",
  "/docs/dpp": "/docs/dpp-architecture",
  "/docs/dpp/": "/docs/dpp-architecture",
  "/docs/digital-product-passports": "/docs/dpp-architecture",
  "/docs/digital-product-passports/": "/docs/dpp-architecture",
  // Live well-known file already advertises this URL.
  "/docs/resolver": "/docs/gs1-digital-link",
  "/docs/resolver/": "/docs/gs1-digital-link",
};

export function docsRedirect(pathname: string): string | null {
  return REDIRECTS[pathname] ?? null;
}

export function isDocsHub(pathname: string): boolean {
  return pathname === "/docs" || pathname === "/docs/";
}

export function isDocsPage(pathname: string): DocsPageSlug | null {
  const m = pathname.match(/^\/docs\/([a-z0-9-]+)\/?$/);
  if (!m) return null;
  const slug = m[1];
  return (DOCS_PAGES as readonly string[]).includes(slug)
    ? (slug as DocsPageSlug)
    : null;
}

/**
 * Call AFTER isX402DocsPath. /docs/x402 stays on the x402 renderer.
 */
export function isDocsPath(pathname: string): boolean {
  if (docsRedirect(pathname)) return true;
  return isDocsHub(pathname) || isDocsPage(pathname) !== null;
}

export const BANNED_COPY = [
  "GS1 Conformant Resolver",
  "gs1ConformantResolver: true",
  "Bitcoin L1",
  "anchored to Bitcoin",
  "$49/mo",
  "AC-DEMO-001",
  "id.authichain.com/01/",
] as const;

export function assertNoBannedCopy(html: string): string[] {
  return BANNED_COPY.filter(s => html.includes(s));
}

/** Markdown sources compiled by docs-render.ts. */
export const DOCS_SOURCE = {
  hub: "content/docs/public/index.md",
  "gs1-digital-link": "content/docs/public/gs1-digital-link.md",
  verification: "content/docs/public/verification.md",
  "dpp-architecture": "content/docs/public/dpp-architecture.md",
  examples: "content/docs/public/examples.md",
} as const;
