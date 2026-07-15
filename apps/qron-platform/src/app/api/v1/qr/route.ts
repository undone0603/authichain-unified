import { NextResponse } from 'next/server';

// POST /api/v1/qr - Create a new QR code (v1 API)
export async function POST(req: Request) {
  const body = await req.json();
  const { url, style, size, color_dark, color_light, logo_url, campaign_id } = body;

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const qronId = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return NextResponse.json({
    success: true,
    api_version: 'v1',
    qron: {
      id: qronId,
      url,
      short_url: `https://qron.space/q/${qronId}`,
      qr_image_url: `https://qron.space/img/${qronId}.png`,
      qr_svg_url: `https://qron.space/img/${qronId}.svg`,
      style: style || 'classic',
      size: size || 300,
      color_dark: color_dark || '#000000',
      color_light: color_light || '#FFFFFF',
      logo_url: logo_url || null,
      campaign_id: campaign_id || null,
      scan_count: 0,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    protocol: 'QRON',
  }, { status: 201 });
}

// GET /api/v1/qr - List all QR codes
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const campaign = searchParams.get('campaign');

  return NextResponse.json({
    success: true,
    api_version: 'v1',
    qrons: [
      { id: 'qr_001', url: 'https://luxebrand.com/product/001', short_url: 'https://qron.space/q/qr_001', scan_count: 1842, status: 'active', created_at: '2026-04-01T00:00:00Z' },
      { id: 'qr_002', url: 'https://pharmaplus.com/med/painkill', short_url: 'https://qron.space/q/qr_002', scan_count: 932, status: 'active', created_at: '2026-04-15T00:00:00Z' },
      { id: 'qr_003', url: 'https://mycorp.io/promo/spring', short_url: 'https://qron.space/q/qr_003', scan_count: 421, status: 'active', created_at: '2026-05-01T00:00:00Z' },
    ],
    pagination: { page, limit, total: 3, pages: 1 },
    filter: campaign ? { campaign } : null,
    protocol: 'QRON',
  });
}
