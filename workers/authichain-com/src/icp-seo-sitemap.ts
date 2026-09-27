/**
 * /p/<slug> hubs for the authichain.com sitemap. APP_WORKER serves every slug
 * in content/seo/pages.json, so the sitemap lists all authichain.com slugs
 * from the small generated index (never the full pages.json) plus the
 * high-intent paths below, which lead the list.
 */
import sitemapSlugs from "../../../content/seo/sitemap-slugs.json";

export const ICP_SEO_SITEMAP_PATHS = [
  "/p/what-is-a-digital-product-passport",
  "/p/eu-digital-product-passport-batteries",
  "/battery-passport",
  "/p/battery-passport-qr-code-requirements",
  "/p/battery-passport-due-diligence-requirement",
  "/p/eu-battery-regulation-due-diligence-report-deadline",
  "/p/global-battery-alliance-battery-passport-vs-eu-regulation",
  "/p/eu-dpp-registry-customs-verification-at-import",
  "/p/eu-dpp-compliance-checklist",
  "/p/eu-circular-economy-act-digital-product-passport",
  "/p/cannabis-coa-verification-blockchain",
] as const;

const AUTHICHAIN_SLUGS: readonly string[] =
  (sitemapSlugs as Record<string, string[]>)["authichain.com"] ?? [];

export function icpSeoSitemapPaths(): string[] {
  const paths: string[] = [...ICP_SEO_SITEMAP_PATHS];
  const seen = new Set(paths);
  for (const slug of AUTHICHAIN_SLUGS) {
    const path = `/p/${slug}`;
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }
  return paths;
}

export function icpSeoSitemapUrls(): string[] {
  return icpSeoSitemapPaths().map(path => `https://authichain.com${path}`);
}
