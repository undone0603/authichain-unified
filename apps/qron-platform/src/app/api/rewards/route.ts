import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REWARD_CATALOG = [
  { id: 'month_free', name: '1 Month Free Pro', type: 'subscription', cost: 500, description: 'Redeem for one month of Pro plan free.' },
  { id: 'extra_qr_50', name: '50 Extra QR Codes', type: 'quota', cost: 200, description: 'Add 50 QR code slots to your account.' },
  { id: 'ai_style_pack', name: 'AI Style Pack', type: 'feature', cost: 150, description: 'Unlock 20 premium AI art styles for QR codes.' },
  { id: 'custom_domain', name: 'Custom Domain Credit', type: 'feature', cost: 300, description: 'One custom domain for redirect links.' },
  { id: 'upgrade_25', name: '25% Upgrade Discount', type: 'discount', cost: 100, description: '25% off your next plan upgrade.' },
  { id: 'priority_support', name: 'Priority Support (30 days)', type: 'support', cost: 250, description: 'Jump to the front of the support queue for 30 days.' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) return NextResponse.json({ catalog: REWARD_CATALOG });

  const [creditsResult, historyResult] = await Promise.all([
    supabase.from('referral_credits').select('total_credits').eq('user_id', user_id).single(),
    supabase.from('reward_redemptions').select('reward_id, cost, redeemed_at').eq('user_id', user_id).order('redeemed_at', { ascending: false }),
  ]);

  const available = creditsResult.data?.total_credits || 0;

  return NextResponse.json({
    available_credits: available,
    catalog: REWARD_CATALOG.map((r) => ({ ...r, can_afford: available >= r.cost })),
    redemption_history: historyResult.data || [],
  });
}

export async function POST(req: NextRequest) {
  const { user_id, reward_id } = await req.json();
  if (!user_id || !reward_id) return NextResponse.json({ error: 'user_id and reward_id required' }, { status: 400 });

  const reward = REWARD_CATALOG.find((r) => r.id === reward_id);
  if (!reward) return NextResponse.json({ error: `Unknown reward: ${reward_id}` }, { status: 404 });

  const { data: credits } = await supabase.from('referral_credits').select('total_credits').eq('user_id', user_id).single();
  if (!credits) return NextResponse.json({ error: 'No credits found' }, { status: 404 });
  if (credits.total_credits < reward.cost) return NextResponse.json({ error: 'Insufficient credits', available: credits.total_credits, required: reward.cost }, { status: 400 });

  await supabase.from('referral_credits').update({ total_credits: credits.total_credits - reward.cost, updated_at: new Date().toISOString() }).eq('user_id', user_id);
  await supabase.from('reward_redemptions').insert({ user_id, reward_id, reward_name: reward.name, reward_type: reward.type, cost: reward.cost, redeemed_at: new Date().toISOString() });

  return NextResponse.json({ success: true, reward_name: reward.name, cost: reward.cost, credits_remaining: credits.total_credits - reward.cost });
}
