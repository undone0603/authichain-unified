'use client';

import Script from 'next/script';

/**
 * Self-hosted Umami analytics (https://umami.is) tracker.
 *
 * Umami is free, open-source, and privacy-first (no cookies, GDPR/CCPA
 * compliant out of the box) -- it gives the autonomous marketing/outreach
 * workflows (marketing-autonomous.yml, b2b-outreach.yml, ghost-traffic.yml,
 * gen-seo-pages.yml, reddit-monitor.yml, etc.) a real feedback loop: page
 * views, referrers, and UTM/campaign attribution across all four brand
 * domains (qron.space, authichain.com, govchain.us, strainchain.io).
 *
 * No-ops entirely (renders nothing, loads nothing) unless both env vars
 * are configured, so this is safe to ship even before the Umami instance
 * is deployed.
 *
 * Setup:
 *   1. Self-host Umami (Docker/Cloudflare/Vercel -- see docs/analytics/umami.md)
 *      or use the free-tier Umami Cloud.
 *   2. Add a website in the Umami dashboard for each brand domain.
 *   3. Set NEXT_PUBLIC_UMAMI_SCRIPT_URL (e.g. https://analytics.example.com/script.js)
 *      and NEXT_PUBLIC_UMAMI_WEBSITE_ID in your environment.
 */
export function UmamiAnalytics() {
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  if (!scriptUrl || !websiteId) {
    return null;
  }

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      strategy="afterInteractive"
      defer
    />
  );
}
