import { NextRequest, NextResponse } from 'next/server';

// GET /api/users - Get current user profile
export async function GET(req: NextRequest) {
  try {
    const user = {
      id: 'usr_001',
      email: 'admin@qron.space',
      name: 'Alex Chen',
      role: 'owner',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      plan: 'business',
      company: 'QRON Labs',
      timezone: 'America/New_York',
      created_at: '2024-09-01',
      last_login: new Date().toISOString(),
      settings: {
        notifications_email: true,
        notifications_slack: true,
        two_factor_enabled: false,
        api_key: 'qron_live_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      },
      usage_this_month: {
        qr_codes_created: 12,
        scans: 4821,
        api_calls: 2341,
        exports: 3,
      },
    };
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PATCH /api/users - Update user profile
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, company, timezone } = body;
    return NextResponse.json({
      success: true,
      user: {
        id: 'usr_001',
        name: name || 'Alex Chen',
        company: company || 'QRON Labs',
        timezone: timezone || 'America/New_York',
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Users PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
