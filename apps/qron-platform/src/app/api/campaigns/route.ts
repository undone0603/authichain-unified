import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({
    success: true,
    endpoint: '/api/campaigns',
    campaigns: [
      { id: 'camp_001', name: 'Product Launch Q2', status: 'active', qrons_generated: 5000, scans: 12400, conversion_rate: 0.032, created_at: '2026-04-01T00:00:00Z' },
      { id: 'camp_002', name: 'Trade Show 2026', status: 'scheduled', qrons_generated: 2000, scans: 0, conversion_rate: 0, created_at: '2026-05-01T00:00:00Z' },
      { id: 'camp_003', name: 'Holiday Promo', status: 'draft', qrons_generated: 0, scans: 0, conversion_rate: 0, created_at: '2026-05-09T00:00:00Z' },
    ],
    total: 3,
    stats: { active: 1, scheduled: 1, draft: 1, total_scans: 12400 },
    protocol: 'QRON',
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    success: true,
    endpoint: '/api/campaigns',
    campaign: {
      id: `camp_${Date.now()}`,
      name: body.name || 'New Campaign',
      status: 'draft',
      qrons_generated: 0,
      scans: 0,
      created_at: new Date().toISOString(),
    },
    message: 'Campaign created successfully',
    protocol: 'QRON',
  });
}
