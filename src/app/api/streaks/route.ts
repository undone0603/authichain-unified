import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: stats } = await supabase
      .from('usage_stats')
      .select('streak_days, longest_streak, last_active_at, streak_started_at')
      .eq('user_id', user.id)
      .single();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActive = stats?.last_active_at ? new Date(stats.last_active_at) : null;
    const daysSinceActive = lastActive ? Math.floor((today.getTime() - lastActive.getTime()) / 86400000) : 999;
    const isAlive = daysSinceActive <= 1;

    const milestones = [
      { days: 7, label: 'Week Warrior', achieved: (stats?.streak_days || 0) >= 7 },
      { days: 14, label: '2-Week Streak', achieved: (stats?.streak_days || 0) >= 14 },
      { days: 30, label: 'Monthly Champion', achieved: (stats?.streak_days || 0) >= 30 },
      { days: 90, label: 'Quarter Hero', achieved: (stats?.streak_days || 0) >= 90 },
      { days: 365, label: 'Annual Legend', achieved: (stats?.streak_days || 0) >= 365 },
    ];

    return NextResponse.json({
      current_streak: isAlive ? (stats?.streak_days || 0) : 0,
      longest_streak: stats?.longest_streak || 0,
      last_active_at: stats?.last_active_at || null,
      streak_alive: isAlive,
      days_since_active: daysSinceActive,
      milestones,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: stats } = await supabase
      .from('usage_stats')
      .select('streak_days, longest_streak, last_active_at')
      .eq('user_id', user.id)
      .single();

    const lastActive = stats?.last_active_at ? new Date(stats.last_active_at) : null;
    const daysSince = lastActive ? Math.floor((today.getTime() - lastActive.getTime()) / 86400000) : 999;

    let newStreak = 1;
    if (daysSince === 0) {
      newStreak = stats?.streak_days || 1;
    } else if (daysSince === 1) {
      newStreak = (stats?.streak_days || 0) + 1;
    }

    const longest = Math.max(newStreak, stats?.longest_streak || 0);

    await supabase.from('usage_stats').upsert({
      user_id: user.id,
      streak_days: newStreak,
      longest_streak: longest,
      last_active_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ streak_days: newStreak, longest_streak: longest, updated: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
