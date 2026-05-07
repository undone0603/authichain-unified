/**
 * @file middleware.ts
 * @project qron-platform
 * @author AuthiChain Legal Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 * 
 * This source code is proprietary and confidential. Unauthorized copying, 
 * distribution, or modification is strictly prohibited under the 
 * AuthiChain Software License (LICENSE.md).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Multi-Domain Routing Middleware for AuthiChain Ecosystem.
 * Maps hostnames to internal paths for specific product brands.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // 1. System Routes & Shared App Routes (NEVER REWRITE)
  const isSystemRoute = 
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/media') ||
    url.pathname.includes('.');

  const isAppRoute = 
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/success') ||
    url.pathname.startsWith('/terms') ||
    url.pathname.startsWith('/privacy') ||
    url.pathname.startsWith('/governance') ||
    url.pathname.startsWith('/digital-product-passport') ||
    url.pathname.startsWith('/authichain') ||
    url.pathname.startsWith('/p/') || 
    url.pathname.startsWith('/s/');

  if (isSystemRoute || isAppRoute) {
    return NextResponse.next();
  }

  // 2. Multi-domain routing logic
  // Rewrite the ROOT path ('/') and all sub-paths for branded domains.
  const hostname = host.toLowerCase().split(':')[0];
  
  // GovChain.us
  if (hostname.includes('govchain.us')) {
    const path = url.pathname === '/' ? '/governance' : `/governance${url.pathname}`;
    return NextResponse.rewrite(new URL(path, request.url));
  }

  // StrainChain.io
  if (hostname.includes('strainchain.io')) {
    const path = url.pathname === '/' ? '/digital-product-passport' : `/digital-product-passport${url.pathname}`;
    return NextResponse.rewrite(new URL(path, request.url));
  }

  // Authichain.com
  if (hostname.includes('authichain.com')) {
    const path = url.pathname === '/' ? '/authichain' : `/authichain${url.pathname}`;
    return NextResponse.rewrite(new URL(path, request.url));
  }

  // Default (QRON.space or unknown)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (media, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|media).*)',
  ],
};
