import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const cutoffDate = new Date('2026-06-15T00:00:00Z');
  const currentDate = new Date();

  // Target organization compliance dashboards
  if (request.nextUrl.pathname.startsWith('/dashboard/compliance')) {
    // 1. Extract tenant meta-data from your edge session/cookies
    const planTier = request.cookies.get('org_plan_tier')?.value;
    const orgId = request.cookies.get('org_id')?.value || 'generic';

    // 2. Enforce lock after the grace period drops
    if (currentDate > cutoffDate && planTier !== 'enterprise_compliance') {
      const billingUrl = new URL('/billing/upgrade-required', request.url);
      billingUrl.searchParams.set('orgId', orgId);
      billingUrl.searchParams.set('reason', 'regulatory_lock');
      
      return NextResponse.redirect(billingUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/compliance/:path*'],
};
