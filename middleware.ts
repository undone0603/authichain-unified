import { NextRequest, NextResponse } from 'next/server';
import { resolveBrand, resolveRootRewrite } from '@/lib/brand-routing';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

export function middleware(req: NextRequest) {
  try {
    const host = req.headers.get('host') ?? req.nextUrl.hostname;
    const pathname = req.nextUrl.pathname;

    const brand = resolveBrand(host);

    const reqHeaders = new Headers(req.headers);
    reqHeaders.set('x-brand', brand);

    if (pathname === '/') {
      const rewriteTo = resolveRootRewrite(host);
      if (rewriteTo) {
        const url = req.nextUrl.clone();
        url.pathname = rewriteTo;
        return NextResponse.rewrite(url, { request: { headers: reqHeaders } });
      }
    }

    return NextResponse.next({ request: { headers: reqHeaders } });
  } catch {
    // Graceful degradation: if middleware fails, pass the request through unchanged.
    return NextResponse.next();
  }
}
