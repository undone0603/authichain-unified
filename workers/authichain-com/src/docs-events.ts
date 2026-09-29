/**
 * Structured logs for the public docs funnel. Workers Logs counts them.
 * No email, IP, or free text: path plus truncated UTM tags only.
 */
import { isDocsHub, isDocsPage } from "./docs-pages";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

/** Destinations the docs money path actually links to. */
const CTA_PATHS = new Set([
  "/dpp-check",
  "/checkout/dpp_readiness",
  "/onboard",
  "/x402",
]);

export type DocsFunnelEvent = Record<string, string>;

function utmFrom(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key)?.trim().slice(0, 64);
    if (value) out[key] = value;
  }
  return out;
}

/** GET /docs or a wave-1 article. Redirects and other methods are not views. */
export function docsViewEvent(method: string, pathname: string): DocsFunnelEvent | null {
  if (method.toUpperCase() !== "GET") return null;
  if (isDocsHub(pathname)) return { evt: "docs_hub_view", path: "/docs" };
  const slug = isDocsPage(pathname);
  if (!slug) return null;
  return { evt: "docs_article_view", path: `/docs/${slug}`, slug };
}

/**
 * A navigation that left the docs with utm_source=docs. GET only, so the
 * later checkout POST stays on dpp_checkout_click.
 */
export function docsCtaClickEvent(method: string, url: URL): DocsFunnelEvent | null {
  if (method.toUpperCase() !== "GET") return null;
  if (url.searchParams.get("utm_source")?.trim() !== "docs") return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!CTA_PATHS.has(path)) return null;
  return { evt: "docs_cta_click", path, ...utmFrom(url) };
}
