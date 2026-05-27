import { NextResponse, type NextRequest } from 'next/server';
import { resolveBrand } from '../../shared/brands';

export function middleware(req: NextRequest) {
  const host = req.nextUrl.hostname;
  const brand = resolveBrand(host);

  const res = NextResponse.next();
  res.headers.set('X-Brand', brand);

  return res;
}
