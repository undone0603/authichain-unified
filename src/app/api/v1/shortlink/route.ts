import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const code = searchParams.get('code');

  const shortlinks = [
    {
      id: 'sl_001',
      user_id: 'user_001',
      code: 'promo24',
      short_url: 'https://qron.space/r/promo24',
      destination_url: 'https://mystore.com/summer-sale',
      qr_code_id: 'qr_001',
      title: 'Summer Sale Campaign',
      clicks: 2847,
      unique_clicks: 1923,
      status: 'active',
      utm_source: 'qron',
      utm_medium: 'qr',
      utm_campaign: 'summer_sale_2026',
      created_at: '2026-04-01T00:00:00Z',
      expires_at: null
    },
    {
      id: 'sl_002',
      user_id: 'user_001',
      code: 'menu',
      short_url: 'https://qron.space/r/menu',
      destination_url: 'https://restaurant.com/menu',
      qr_code_id: 'qr_007',
      title: 'Restaurant Menu QR',
      clicks: 18492,
      unique_clicks: 12830,
      status: 'active',
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      created_at: '2025-11-15T00:00:00Z',
      expires_at: null
    },
    {
      id: 'sl_003',
      user_id: 'user_001',
      code: 'event2025',
      short_url: 'https://qron.space/r/event2025',
      destination_url: 'https://eventbrite.com/e/12345',
      qr_code_id: 'qr_012',
      title: 'Conference Registration',
      clicks: 445,
      unique_clicks: 398,
      status: 'expired',
      utm_source: 'qron',
      utm_medium: 'print',
      utm_campaign: 'tech_conf_2025',
      created_at: '2025-09-01T00:00:00Z',
      expires_at: '2025-12-31T23:59:59Z'
    }
  ];

  let filtered = shortlinks;
  if (user_id) filtered = filtered.filter(s => s.user_id === user_id);
  if (code) filtered = filtered.filter(s => s.code === code);

  const total_clicks = filtered.reduce((sum, s) => sum + s.clicks, 0);

  return NextResponse.json({
    success: true,
    shortlinks: filtered,
    total: filtered.length,
    total_clicks,
    base_url: 'https://qron.space/r/',
    generated_at: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { destination_url, code, title, user_id, expires_at } = body;

  if (!destination_url || !user_id) {
    return NextResponse.json({ success: false, error: 'destination_url and user_id are required' }, { status: 400 });
  }

  const generated_code = code || Math.random().toString(36).substring(2, 8);

  return NextResponse.json({
    success: true,
    shortlink: {
      id: `sl_${Date.now()}`,
      user_id,
      code: generated_code,
      short_url: `https://qron.space/r/${generated_code}`,
      destination_url,
      title: title || destination_url,
      clicks: 0,
      unique_clicks: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: expires_at || null
    },
    created_at: new Date().toISOString()
  }, { status: 201 });
}
