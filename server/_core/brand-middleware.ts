// server/_core/brand-middleware.ts
import type { RequestHandler } from 'express';
import { resolveBrand, type BrandId } from '../../shared/brands';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      brand?: BrandId;
    }
  }
}

/**
 * Attaches the active brand (derived from the Host header) to
 * `res.locals.brand` and sets an `X-Brand` response header.
 *
 * The client resolves its own brand a second time from `window.location.hostname`
 * inside BrandContext — this middleware exists so server-side code (tRPC
 * handlers, analytics, logs) can see which brand the request came in on.
 */
export const brandMiddleware: RequestHandler = (req, res, next) => {
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? '';
  const brand = resolveBrand(host);
  res.locals.brand = brand;
  res.setHeader('X-Brand', brand);
  next();
};

/**
 * Builds the `<script>window.__BRAND__ = '<id>';</script>` snippet that
 * injects the brand into the HTML before React mounts. Used by the
 * Vite dev middleware and the static-serve fallback. Safe to inline
 * because brand id is a closed union of 4 known strings.
 */
export function brandInjectionScript(brand: BrandId): string {
  return `<script>window.__BRAND__=${JSON.stringify(brand)};document.documentElement.setAttribute('data-brand',${JSON.stringify(brand)});</script>`;
}

import { BRANDS } from '../../shared/brands';

/**
 * Dynamically replaces <title>, <meta>, and <link> tags in the HTML template
 * with brand-specific values from the shared config.
 */
export function injectBrandMetadata(html: string, brandId: BrandId): string {
  const brand = BRANDS[brandId];
  const title = `${brand.displayName} — ${brand.tagline}`;
  const description = brand.description;
  const url = `https://${brand.domain}`;
  const icon = `/favicon-${brandId}.svg`;
  const appleIcon = `/apple-touch-icon-${brandId}.png`;
  const ogImage = `/og-${brandId}.png`; // Assumes these exist or fallback to generic

  return html
    // Title
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    // Meta tags
    .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${url}${ogImage}" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${description}" />`)
    .replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${url}${ogImage}" />`)
    // Link tags
    .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<link rel="icon" type="image\/svg\+xml" href=".*?" \/>/, `<link rel="icon" type="image/svg+xml" href="${icon}" />`)
    .replace(/<link rel="apple-touch-icon" href=".*?" \/>/, `<link rel="apple-touch-icon" href="${appleIcon}" />`);
}
