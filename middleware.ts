import { NextResponse, type NextRequest } from 'next/server';
import { middleware as supabaseMiddleware } from './utils/supabase/middleware';
import { middleware as brandMiddleware } from './server/_core/brand-middleware';

export const config = {
  matcher: ['/:path*'],
};

export async function middleware(req: NextRequest) {
  const res = await supabaseMiddleware(req);
  const brandRes = brandMiddleware(req);
  brandRes.headers.forEach((v, k) => res.headers.set(k, v));
  return res;
}
