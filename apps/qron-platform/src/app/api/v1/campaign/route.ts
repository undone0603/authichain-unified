import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1/campaign - List QR code campaigns with analytics
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const status = searchParams.get('status');
  const campaign_type = searchParams.get('campaign_type');

  const campaigns = [
    {
      id: 'camp_001',
      user_id: 'usr_001',
      name: 'Summer Product Launch 2026',
      description: 'QR codes for new product packaging rollout',
      campaign_type: 'product',
      status: 'active',
      qr_count: 250,
      total_scans: 18420,
      unique_scans: 12340,
      conversion_rate: 0.23,
      start_date: '2026-04-01',
      end_date: '2026-09-30',
      created_at: '2026-03-15T10:00:00Z',
      tags: ['summer', 'product-launch', 'packaging'],
      redirect_url: 'https://brand.example.com/summer2026',
      utm_source: 'qron',
      utm_medium: 'qr',
      utm_campaign: 'summer_launch_2026'
    },
    {
      id: 'camp_002',
      user_id: 'usr_001',
      name: 'Restaurant Menu QRs',
      description: 'Digital menu access for all locations',
      campaign_type: 'menu',
      status: 'active',
      qr_count: 48,
      total_scans: 89234,
      unique_scans: 45120,
      conversion_rate: 0.61,
      start_date: '2025-11-01',
      end_date: null,
      created_at: '2025-10-20T09:00:00Z',
      tags: ['restaurant', 'menu', 'hospitality'],
      redirect_url: 'https://restaurant.example.com/menu',
      utm_source: 'qron',
      utm_medium: 'qr',
      utm_campaign: 'menu_access'
    },
    {
      id: 'camp_003',
      user_id: 'usr_002',
      name: 'Trade Show Booth 2026',
      description: 'Lead capture and product info QRs for CES 2026',
      campaign_type: 'event',
      status: 'completed',
      qr_count: 12,
      total_scans: 3401,
      unique_scans: 3210,
      conversion_rate: 0.18,
      start_date: '2026-01-07',
      end_date: '2026-01-10',
      created_at: '2026-12-15T08:00:00Z',
      tags: ['ces', 'tradeshow', 'lead-gen'],
      redirect_url: 'https://company.example.com/ces2026',
      utm_source: 'qron',
      utm_medium: 'qr',
      utm_campaign: 'ces_2026'
    }
  ];

  let filtered = campaigns;
  if (user_id) filtered = filtered.filter(c => c.user_id === user_id);
  if (status) filtered = filtered.filter(c => c.status === status);
  if (campaign_type) filtered = filtered.filter(c => c.campaign_type === campaign_type);

  const total_scans = filtered.reduce((sum, c) => sum + c.total_scans, 0);
  const total_qrs = filtered.reduce((sum, c) => sum + c.qr_count, 0);

  return NextResponse.json({
    success: true,
    campaigns: filtered,
    total: filtered.length,
    total_scans,
    total_qrs,
    campaign_types: ['product', 'menu', 'event', 'marketing', 'authentication', 'loyalty'],
    statuses: ['draft', 'active', 'paused', 'completed', 'archived'],
    generated_at: new Date().toISOString()
  });
}

// POST /api/v1/campaign - Create new campaign
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, campaign_type, user_id, redirect_url, start_date, end_date } = body;

    if (!name || !campaign_type || !user_id) {
      return NextResponse.json({ error: 'Missing required fields: name, campaign_type, user_id' }, { status: 400 });
    }

    const campaign = {
      id: `camp_${Date.now()}`,
      user_id,
      name,
      description: description || '',
      campaign_type,
      status: 'draft',
      qr_count: 0,
      total_scans: 0,
      unique_scans: 0,
      conversion_rate: 0,
      start_date: start_date || null,
      end_date: end_date || null,
      created_at: new Date().toISOString(),
      tags: [],
      redirect_url: redirect_url || null,
      utm_source: 'qron',
      utm_medium: 'qr',
      utm_campaign: name.toLowerCase().replace(/\s+/g, '_')
    };

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
