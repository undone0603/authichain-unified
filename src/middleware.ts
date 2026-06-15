import { NextRequest, NextResponse } from 'next/server';
import { BRAND_BASE, PRIMARY_DOMAIN } from '@/lib/brand-domains';

/**
 * 1. Canonical-host redirect: www.qron.space → qron.space (301)
 * 2. Alias-domain redirect: qron.io → qron.space (301)
 * All other hosts pass through unchanged.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const canonical = BRAND_BASE[host];

  // Only redirect if the host is a known alias AND it differs from itself
  // (i.e. www.qron.space → qron.space, qron.io → qron.space)
  if (canonical && !canonical.includes(host)) {
    const url = req.nextUrl.clone();
    url.host = new URL(canonical).host;
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|media/).*)'],
};
