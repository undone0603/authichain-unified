import { NextRequest, NextResponse } from 'next/server';

const PLANS = {
  free: { name: 'Free', price: 0, qr_codes: 5, scans_per_month: 500, features: ['Basic QR codes', 'Standard analytics', 'Email support'] },
  starter: { name: 'Starter', price: 9, qr_codes: 50, scans_per_month: 5000, features: ['Dynamic QR codes', 'Advanced analytics', 'Custom colors', 'Priority support'] },
  pro: { name: 'Pro', price: 29, qr_codes: 500, scans_per_month: 50000, features: ['Unlimited dynamic QR', 'AI art styling', 'Custom domains', 'Bulk generation', 'API access', '24/7 support'] },
  business: { name: 'Business', price: 99, qr_codes: -1, scans_per_month: -1, features: ['Everything in Pro', 'White-label', 'SSO/SAML', 'SLA guarantee', 'Dedicated manager', 'Custom integrations'] }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');

  const subscription = {
    id: 'sub_001',
    user_id: user_id || 'user_001',
    plan: 'pro',
    plan_details: PLANS.pro,
    status: 'active',
    current_period_start: '2026-05-01',
    current_period_end: '2026-05-31',
    next_billing_date: '2026-06-01',
    next_billing_amount: 29,
    cancel_at_period_end: false,
    payment_method: { type: 'card', brand: 'Visa', last4: '4242', exp_month: 12, exp_year: 2027 },
    usage: {
      qr_codes_created: 127,
      qr_codes_limit: 500,
      scans_this_month: 8432,
      scans_limit: 50000,
      api_calls_today: 340,
      storage_used_mb: 24.7
    }
  };

  const invoices = [
    { id: 'inv_001', amount: 29, currency: 'usd', status: 'paid', period: 'May 2026', date: '2026-05-01', pdf_url: '/invoices/inv_001.pdf' },
    { id: 'inv_002', amount: 29, currency: 'usd', status: 'paid', period: 'Apr 2026', date: '2026-04-01', pdf_url: '/invoices/inv_002.pdf' },
    { id: 'inv_003', amount: 9, currency: 'usd', status: 'paid', period: 'Mar 2026', date: '2026-03-01', pdf_url: '/invoices/inv_003.pdf' }
  ];

  return NextResponse.json({
    success: true,
    subscription,
    invoices,
    available_plans: Object.entries(PLANS).map(([id, plan]) => ({ id, ...plan })),
    generated_at: new Date().toISOString()
  });
}
