import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({
    success: true,
    endpoint: '/api/profile',
    profile: {
      id: 'usr_001',
      name: 'Demo User',
      email: 'demo@qron.space',
      plan: 'professional',
      plan_details: {
        name: 'Professional',
        price_usd_monthly: 99,
        qrons_limit: 10000,
        qrons_used: 4231,
        scan_tracking: true,
        custom_domains: 3,
        ai_styles: true,
      },
      created_at: '2026-01-15T00:00:00Z',
      avatar_url: 'https://qron.space/avatars/demo.png',
    },
    protocol: 'QRON',
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    success: true,
    endpoint: '/api/profile',
    message: 'Profile updated successfully',
    profile: { ...body, updated_at: new Date().toISOString() },
    protocol: 'QRON',
  });
}
