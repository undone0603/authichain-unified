import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');

  const referral_program = {
    program_name: 'QRON Referral Program',
    reward_per_referral: 10,
    reward_currency: 'USD',
    reward_type: 'account_credit',
    referee_reward: 10,
    reward_trigger: 'paid_subscription',
    terms: 'Earn $10 credit for each friend who upgrades to a paid plan. Your friend also gets $10 off their first month.',
    max_referrals: null,
    active: true
  };

  const user_referrals = [
    {
      id: 'ref_001',
      referrer_id: user_id || 'user_001',
      referee_email: 'friend1@example.com',
      status: 'converted',
      reward_earned: 10,
      reward_paid: true,
      signed_up_at: '2026-03-15T00:00:00Z',
      converted_at: '2026-03-18T00:00:00Z'
    },
    {
      id: 'ref_002',
      referrer_id: user_id || 'user_001',
      referee_email: 'colleague@company.com',
      status: 'signed_up',
      reward_earned: 0,
      reward_paid: false,
      signed_up_at: '2026-04-22T00:00:00Z',
      converted_at: null
    },
    {
      id: 'ref_003',
      referrer_id: user_id || 'user_001',
      referee_email: 'partner@agency.io',
      status: 'pending',
      reward_earned: 0,
      reward_paid: false,
      signed_up_at: null,
      converted_at: null
    }
  ];

  const stats = {
    total_referrals: user_referrals.length,
    converted: user_referrals.filter(r => r.status === 'converted').length,
    pending: user_referrals.filter(r => r.status === 'pending').length,
    total_earned: user_referrals.reduce((sum, r) => sum + r.reward_earned, 0),
    total_paid_out: user_referrals.filter(r => r.reward_paid).reduce((sum, r) => sum + r.reward_earned, 0)
  };

  const referral_code = `QRON-${(user_id || 'USER001').toUpperCase().replace('_', '')}`;
  const referral_link = `https://qron.space/signup?ref=${referral_code}`;

  return NextResponse.json({
    success: true,
    referral_code,
    referral_link,
    program: referral_program,
    referrals: user_referrals,
    stats,
    generated_at: new Date().toISOString()
  });
}
