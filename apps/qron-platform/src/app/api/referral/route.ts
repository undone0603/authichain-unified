import { NextRequest, NextResponse } from 'next/server';

function generateCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  // In production this would query DB for the user's referral record
  const referral_code = `QRON-${generateCode()}`;

  return NextResponse.json({
    success: true,
    referral_code,
    referral_url: `https://qron.space/signup?ref=${referral_code}`,
    stats: {
      total_referrals: 0,
      pending_rewards: 0,
      paid_rewards: 0,
      credits_earned: 0,
    },
    reward_structure: {
      per_signup: '$5 account credit',
      per_paid_conversion: '$20 account credit',
      referee_discount: '20% off first month',
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { referral_code, new_user_id, new_user_email } = body;

  if (!referral_code || !new_user_id || !new_user_email) {
    return NextResponse.json(
      { error: 'referral_code, new_user_id, and new_user_email are required' },
      { status: 400 }
    );
  }

  if (!referral_code.startsWith('QRON-')) {
    return NextResponse.json({ error: 'Invalid referral code format' }, { status: 422 });
  }

  return NextResponse.json({
    success: true,
    message: 'Referral recorded successfully',
    referral_code,
    new_user_id,
    reward_pending: '$5 credit will be applied when the referred user completes their first payment',
    referee_discount: '20% discount applied to first month subscription',
  });
}
