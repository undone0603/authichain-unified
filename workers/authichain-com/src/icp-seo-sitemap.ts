/**
 * High-intent /p/<slug> hubs that already 200 on apex. Sitemap only lists
 * URLs this worker or APP_WORKER actually serves.
 */
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

export function icpSeoSitemapUrls(): string[] {
  return ICP_SEO_SITEMAP_PATHS.map(path => `https://authichain.com${path}`);
}
