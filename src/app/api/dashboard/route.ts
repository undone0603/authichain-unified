import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const [qrResult, scanResult, subResult, badgeResult] = await Promise.all([
    supabase.from('qr_codes').select('id, name, created_at, scan_count, is_active').eq('user_id', user_id).order('created_at', { ascending: false }).limit(10),
    supabase.from('scan_events').select('scanned_at, qr_code_id').eq('user_id', user_id).order('scanned_at', { ascending: false }).limit(30),
    supabase.from('subscriptions').select('plan, status, current_period_end').eq('user_id', user_id).single(),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user_id),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentScans = (scanResult.data || []).filter(
    (s) => new Date(s.scanned_at) >= thirtyDaysAgo
  ).length;

  return NextResponse.json({
    qr_codes: qrResult.data || [],
    recent_scans_30d: recentScans,
    subscription: subResult.data || null,
    badges_earned: (badgeResult.data || []).length,
    last_updated: now.toISOString(),
  });
}
