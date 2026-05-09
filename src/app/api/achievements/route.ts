import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACHIEVEMENT_CATALOG = [
  { id: 'first_qr', name: 'First QR', description: 'Created your first QR code', icon: '🎯', credits: 50 },
  { id: 'qr_10', name: 'Power Creator', description: 'Created 10 QR codes', icon: '🚀', credits: 100 },
  { id: 'qr_50', name: 'QR Machine', description: 'Created 50 QR codes', icon: '⚡', credits: 200 },
  { id: 'first_scan', name: 'First Scan', description: 'Got your first QR code scan', icon: '📱', credits: 25 },
  { id: 'scan_100', name: 'Scan Century', description: 'Reached 100 total scans', icon: '💯', credits: 150 },
  { id: 'scan_1000', name: 'Viral QR', description: 'Reached 1,000 total scans', icon: '🔥', credits: 500 },
  { id: 'referral_1', name: 'Connector', description: 'Referred your first user', icon: '🤝', credits: 100 },
  { id: 'referral_5', name: 'Ambassador', description: 'Referred 5 users', icon: '🌟', credits: 300 },
  { id: 'upgraded', name: 'Pro Member', description: 'Upgraded to a paid plan', icon: '👑', credits: 200 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) return NextResponse.json({ catalog: ACHIEVEMENT_CATALOG });

  const { data: earned } = await supabase
    .from('user_achievements')
    .select('achievement_id, earned_at, credits_awarded')
    .eq('user_id', user_id);

  const earnedIds = new Set((earned || []).map((a) => a.achievement_id));
  const totalCredits = (earned || []).reduce((sum, a) => sum + (a.credits_awarded || 0), 0);

  return NextResponse.json({
    earned: earned || [],
    total_achievements: earnedIds.size,
    total_credits_from_achievements: totalCredits,
    catalog: ACHIEVEMENT_CATALOG.map((a) => ({
      ...a,
      earned: earnedIds.has(a.id),
      earned_at: (earned || []).find((e) => e.achievement_id === a.id)?.earned_at || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { user_id, achievement_id } = await req.json();
  if (!user_id || !achievement_id)
    return NextResponse.json({ error: 'user_id and achievement_id required' }, { status: 400 });

  const achievement = ACHIEVEMENT_CATALOG.find((a) => a.id === achievement_id);
  if (!achievement) return NextResponse.json({ error: 'Unknown achievement' }, { status: 404 });

  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', user_id)
    .eq('achievement_id', achievement_id)
    .single();

  if (existing) return NextResponse.json({ message: 'Already earned', already_earned: true });

  await supabase.from('user_achievements').insert({
    user_id,
    achievement_id,
    achievement_name: achievement.name,
    credits_awarded: achievement.credits,
    earned_at: new Date().toISOString(),
  });

  const { data: credits } = await supabase.from('referral_credits').select('total_credits').eq('user_id', user_id).single();
  const current = credits?.total_credits || 0;
  await supabase.from('referral_credits').upsert({ user_id, total_credits: current + achievement.credits, updated_at: new Date().toISOString() });

  return NextResponse.json({ success: true, achievement: achievement.name, credits_awarded: achievement.credits });
}
