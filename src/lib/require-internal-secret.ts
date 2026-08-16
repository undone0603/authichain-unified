import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Gate a guardrail route to service-to-service callers only. Unlike the
 * existing per-cron `authorized()` helpers (e.g. src/app/api/cron/retention/route.ts),
 * which allow requests through when no secret is configured (for local dev),
 * this fails CLOSED: a missing INTERNAL_API_SECRET denies every request,
 * because an unauthenticated guardrail endpoint would defeat the whole point
 * of the caps layer.
 */
export function requireInternalSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET not configured' }, { status: 503 });
  }
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const internal = req.headers.get('x-internal-secret') ?? '';
  const provided = internal || bearer;
  if (!provided || !timingSafeStringEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
