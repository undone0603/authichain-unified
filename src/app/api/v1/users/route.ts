export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth-middleware';

/**
 * GET /api/v1/users
 * Returns the authenticated user's own profile only.
 * Admin-level user listing is handled by /api/admin/stats.
 */
export async function GET(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const { data: profile, error } = await admin
    .from('profiles')
    .select('user_id, display_name, email, tier, qrons_count, total_scans, api_calls_month, created_at, last_active_at, mfa_enabled')
    .eq('user_id', session.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user: profile,
    protocol: 'QRON',
  });
}
