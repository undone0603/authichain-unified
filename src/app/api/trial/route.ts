import { NextRequest, NextResponse } from 'next/server';

const TRIAL_PLANS = [
  {
    id: 'pro_trial',
    name: 'Pro Trial',
    trial_days: 14,
    converts_to: 'pro',
    price_after_trial: 49,
    qr_codes_limit: 500,
    scans_per_month: 50000,
    ai_styles: 50,
    campaigns: 20,
    team_members: 5,
    custom_domains: 2,
    api_access: true,
    credit_card_required: false,
    features: [
      '500 QR codes',
      '50,000 scans/month',
      '50 AI art styles',
      '20 campaigns',
      '5 team members',
      '2 custom domains',
      'API access',
      'Advanced analytics',
    ],
  },
  {
    id: 'business_trial',
    name: 'Business Trial',
    trial_days: 14,
    converts_to: 'business',
    price_after_trial: 129,
    qr_codes_limit: 5000,
    scans_per_month: 500000,
    ai_styles: -1,
    campaigns: 200,
    team_members: 25,
    custom_domains: 10,
    api_access: true,
    credit_card_required: false,
    features: [
      '5,000 QR codes',
      '500,000 scans/month',
      'Unlimited AI art styles',
      '200 campaigns',
      '25 team members',
      '10 custom domains',
      'API access',
      'Priority support',
      'White-label portal',
    ],
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Start your free 14-day QRON trial. No credit card required.',
    trials: TRIAL_PLANS,
    trust_signals: [
      'No credit card required',
      '14 days full access',
      'Cancel anytime',
      'Free onboarding session',
      'Your QR codes stay active if you upgrade',
    ],
    cta_url: 'https://qron.space/trial',
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, name, company, plan_id = 'pro_trial', use_case, referral_code } = body;

  if (!email) {
    return NextResponse.json({ error: 'email is required to start a trial' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 422 });
  }

  const plan = TRIAL_PLANS.find((p) => p.id === plan_id);
  if (!plan) {
    return NextResponse.json(
      { error: `Invalid plan_id. Must be one of: ${TRIAL_PLANS.map((p) => p.id).join(', ')}` },
      { status: 422 }
    );
  }

  const trial_id = `QRON-TRIAL-${Date.now()}`;
  const trial_start = new Date();
  const trial_end = new Date(trial_start.getTime() + plan.trial_days * 24 * 60 * 60 * 1000);

  // Production: create Supabase user, send SendGrid welcome email,
  // create Stripe customer (no charge), fire Slack webhook to sales channel

  return NextResponse.json(
    {
      success: true,
      trial_id,
      email,
      name: name || null,
      company: company || null,
      plan,
      trial_start: trial_start.toISOString(),
      trial_end: trial_end.toISOString(),
      days_remaining: plan.trial_days,
      status: 'active',
      referral_code: referral_code || null,
      next_steps: [
        'Verify your email to activate your account',
        'Log in to your QRON dashboard at qron.space/dashboard',
        'Create your first AI-styled QR code',
        'Book your free onboarding: qron.space/onboarding-call',
      ],
      upgrade_url: `https://qron.space/upgrade?trial=${trial_id}&plan=${plan.converts_to}`,
      dashboard_url: 'https://qron.space/dashboard',
      message: `Your ${plan.trial_days}-day free QRON trial is active. No credit card required.`,
    },
    { status: 201 }
  );
}
