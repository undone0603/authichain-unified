import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric') || 'scans';
    const period = searchParams.get('period') || 'alltime';
    const limit = parseInt(searchParams.get('limit') || '10');

    let dateFilter = '';
    if (period === 'week') dateFilter = new Date(Date.now() - 7 * 86400000).toISOString();
    else if (period === 'month') dateFilter = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data, error } = await supabase
      .from('usage_stats')
      .select('user_id, profiles(display_name, avatar_url), total_scans, total_qrons, streak_days, milestone_count')
      .order(metric === 'milestones' ? 'milestone_count' : metric === 'streak' ? 'streak_days' : 'total_scans', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const leaderboard = (data || []).map((row: any, index: number) => ({
      rank: index + 1,
      user_id: row.user_id,
      display_name: row.profiles?.display_name || 'Anonymous',
      avatar_url: row.profiles?.avatar_url || null,
      score: metric === 'milestones' ? row.milestone_count
           : metric === 'streak' ? row.streak_days
           : metric === 'qrons' ? row.total_qrons
           : row.total_scans,
    }));

    return NextResponse.json({ leaderboard, metric, period });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
