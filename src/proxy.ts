// src/proxy.ts — Next.js proxy (canonical location for src/ apps)
//
// Self-contained by design: this file imports NOTHING beyond `next/server`.
// The Edge runtime has no `__dirname`/`__filename`/Node built-ins, and Next's
// edge bundler will pull in (and fail on) any transitive module that touches
// them. Inlining the few constants we need keeps the edge bundle clean and the
// build deterministic. Do not add imports here without verifying edge-safety.
//
// Responsibilities (merged from the former root middleware.ts):
//   1. Resolve the brand from the Host header → x-brand header for SSR layouts.
//   2. Persist affiliate ?ref attribution as a 30-day cookie (read at checkout).
//   3. Gate /dashboard/compliance behind the enterprise_compliance plan tier.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type BrandId = 'authichain' | 'qron' | 'strainchain' | 'govchain';

// Inlined from shared/brands.ts (apex domain → brand). Kept import-free on purpose.
const BRAND_DOMAINS: Array<{ id: BrandId; domain: string; aliases: string[] }> = [
  { id: 'authichain', domain: 'authichain.com', aliases: ['www.authichain.com'] },
  { id: 'qron', domain: 'qron.space', aliases: ['www.qron.space', 'qron.io', 'www.qron.io'] },
  { id: 'strainchain', domain: 'strainchain.io', aliases: ['www.strainchain.io'] },
  { id: 'govchain', domain: 'govchain.us', aliases: ['www.govchain.us'] },
];
const DEFAULT_BRAND: BrandId = 'authichain';

function resolveBrand(hostname: string | null | undefined): BrandId {
  if (!hostname) return DEFAULT_BRAND;
  const host = hostname.toLowerCase().split(':')[0];
  for (const b of BRAND_DOMAINS) {
    if (host === b.domain || b.aliases.includes(host)) return b.id;
  }
  for (const b of BRAND_DOMAINS) {
    if (host.endsWith('.' + b.domain)) return b.id;
    for (const alias of b.aliases) if (host.endsWith('.' + alias)) return b.id;
  }
  for (const b of BRAND_DOMAINS) {
    if (host.includes(b.id)) return b.id;
  }
  return DEFAULT_BRAND;
}

export function proxy(req: NextRequest) {
  // 1. Compliance dashboard gating after the regulatory cutoff.
  if (req.nextUrl.pathname.startsWith('/dashboard/compliance')) {
    const cutoffDate = new Date('2026-06-15T00:00:00Z');
    const planTier = req.cookies.get('org_plan_tier')?.value;
    const orgId = req.cookies.get('org_id')?.value || 'generic';
    if (new Date() > cutoffDate && planTier !== 'enterprise_compliance') {
      const billingUrl = new URL('/billing/upgrade-required', req.url);
      billingUrl.searchParams.set('orgId', orgId);
      billingUrl.searchParams.set('reason', 'regulatory_lock');
      return NextResponse.redirect(billingUrl);
    }
  }

  // 2. Brand resolution → forward via request + response headers.
  const host = req.headers.get('host') ?? req.nextUrl.hostname;
  const brand = resolveBrand(host);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-brand', brand);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('x-brand', brand);

  // 3. Affiliate attribution: persist ?ref=CODE for 30 days (read at checkout).
  const ref = req.nextUrl.searchParams.get('ref');
  if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
    res.cookies.set('aff_ref', ref, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  const isSystemRoute =
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/api') ||
    req.nextUrl.pathname.startsWith('/media') ||
    req.nextUrl.pathname.includes('.');
  const isAppRoute =
    req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/auth') ||
    req.nextUrl.pathname.startsWith('/success') ||
    req.nextUrl.pathname.startsWith('/terms') ||
    req.nextUrl.pathname.startsWith('/privacy') ||
    req.nextUrl.pathname.startsWith('/governance') ||
    req.nextUrl.pathname.startsWith('/digital-product-passport') ||
    req.nextUrl.pathname.startsWith('/authichain') ||
    req.nextUrl.pathname.startsWith('/p/') ||
    req.nextUrl.pathname.startsWith('/s/');
  if (isSystemRoute || isAppRoute) return res;

  const hostname = host.toLowerCase().split(':')[0];
  const routePrefix =
    hostname === 'govchain.us'
      ? '/governance'
      : hostname === 'strainchain.io'
        ? '/digital-product-passport'
        : hostname === 'authichain.com'
          ? '/authichain'
          : null;
  if (routePrefix) {
    const path = req.nextUrl.pathname === '/' ? routePrefix : `${routePrefix}${req.nextUrl.pathname}`;
    const rewritten = NextResponse.rewrite(new URL(path, req.url), {
      request: { headers: reqHeaders },
    });
    rewritten.headers.set('x-brand', brand);
    return rewritten;
  }

  return res;
}

export const config = {
  // Run on everything except Next internals and static assets, so brand + ref
  // attribution work site-wide while keeping the matcher cheap.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
