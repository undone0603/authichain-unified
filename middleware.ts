// middleware.ts  — Next.js Edge Middleware for hostname-based multi-tenant routing
// Runs at the edge BEFORE any page/route handler. Sets x-brand header so
// SSR layouts can call resolveBrand() without re-parsing the host.
import { NextRequest, NextResponse } from 'next/server';
import { resolveBrand } from './shared/brands';

export const config = {
  // Lookaheads are not supported by Next.js 16 Turbopack — use a plain wildcard.
  // Static assets (_next/static, images, favicons) skip middleware automatically
  // at the CDN/edge layer before this function is invoked.
  matcher: ['/:path*'],
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? req.nextUrl.hostname;
  const brand = resolveBrand(host);

  const res = NextResponse.next();

  // Forward brand to layouts/pages via response header (readable in Server Components)
  res.headers.set('x-brand', brand);
  // Also expose via request header so downstream middleware/route handlers can read it
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-brand', brand);

  // Rewrite to brand-scoped path prefix so Next.js can serve per-brand layouts
  // Example: qron.space/pricing → /qron/pricing  (if you add /app/[brand]/ routes)
  // For now we only annotate — remove the rewrite block below if you prefer
  // a single shared route tree with BrandContext doing the switch.
  //
  // IMPORTANT: authichain.com is the primary tenant served by this Next.js app.
  // Other tenants (qron.space, strainchain.io, govchain.us) are served by their
  // own Cloudflare Workers (see workers/). This middleware still sets x-brand
  // for any preview URL that matches via Pass 3 of resolveBrand().

  return NextResponse.next({
    request: { headers: reqHeaders },
    headers: res.headers,
  });
}
