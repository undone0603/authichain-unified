import { NextRequest, NextResponse } from 'next/server';

// GET /api/billing - Get subscription and billing info
export async function GET(req: NextRequest) {
  try {
    const billing = {
      subscription: {
        plan: 'business',
        status: 'active',
        current_period_start: '2024-11-01',
        current_period_end: '2024-12-01',
        cancel_at_period_end: false,
      },
      usage: {
        qr_codes_created: 847,
        qr_codes_limit: 5000,
        scans_this_month: 14823,
        scans_limit: 100000,
        api_calls_today: 2341,
        api_calls_limit: 10000,
      },
      invoices: [
        { id: 'inv_001', amount: 499, currency: 'USD', status: 'paid', date: '2024-11-01' },
        { id: 'inv_002', amount: 499, currency: 'USD', status: 'paid', date: '2024-10-01' },
        { id: 'inv_003', amount: 499, currency: 'USD', status: 'paid', date: '2024-09-01' },
      ],
      payment_method: {
        type: 'card',
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2026,
      },
    };
    return NextResponse.json({ success: true, billing });
  } catch (error) {
    console.error('Billing GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing info' }, { status: 500 });
  }
}

// POST /api/billing - Update subscription plan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan } = body;
    const validPlans = ['starter', 'business', 'enterprise'];
    if (!plan || !validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan. Choose: starter, business, enterprise' }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      subscription: {
        plan,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Billing POST error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
