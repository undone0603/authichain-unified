import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? req.nextUrl.hostname;

  // Inline brand resolution - no external imports that could break edge bundling
  const brandMap: Record<string, string> = {
    'qron.space': 'qron', 'www.qron.space': 'qron', 'qron.io': 'qron',
    'strainchain.io': 'strainchain', 'www.strainchain.io': 'strainchain',
    'govchain.us': 'govchain', 'www.govchain.us': 'govchain',
    'authichain.com': 'authichain', 'www.authichain.com': 'authichain',
  };

  const h = host.toLowerCase().split(':')[0];
  let brand = brandMap[h] ?? 'authichain';
  if (brand === 'authichain') {
    for (const [k, v] of Object.entries(brandMap)) {
      if (h.endsWith('.' + k) || h.includes(v)) { brand = v; break; }
    }
  }

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-brand', brand);

  return NextResponse.next({ request: { headers: reqHeaders } });
}
