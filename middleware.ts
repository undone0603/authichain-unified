import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

const BRAND_MAP: Record<string, string> = {
  'qron.space': 'qron', 'www.qron.space': 'qron', 'qron.io': 'qron',
  'strainchain.io': 'strainchain', 'www.strainchain.io': 'strainchain',
  'govchain.us': 'govchain', 'www.govchain.us': 'govchain',
  'authichain.com': 'authichain', 'www.authichain.com': 'authichain',
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? req.nextUrl.hostname;
  const pathname = req.nextUrl.pathname;

  const h = host.toLowerCase().split(':')[0];
  let brand = BRAND_MAP[h] ?? 'authichain';
  if (brand === 'authichain') {
    for (const [k, v] of Object.entries(BRAND_MAP)) {
      if (h.endsWith('.' + k) || h.includes(v)) { brand = v; break; }
    }
  }

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-brand', brand);

  // Rewrite root to brand-specific homepage on production domains only
  if (pathname === '/' && brand !== 'qron' && !!BRAND_MAP[h]) {
    const url = req.nextUrl.clone();
    url.pathname = `/brand/${brand}`;
    return NextResponse.rewrite(url, { request: { headers: reqHeaders } });
  }

  return NextResponse.next({ request: { headers: reqHeaders } });
}
