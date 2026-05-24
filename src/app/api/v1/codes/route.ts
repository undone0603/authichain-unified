import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const campaign_id = searchParams.get('campaign_id');
  const type = searchParams.get('type');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const codes = [
    {
      id: 'qr_001',
      name: 'Product Launch QR',
      url: 'https://example.com/product/launch',
      short_url: 'https://qron.space/r/abc123',
      type: 'url',
      campaign_id: 'camp_001',
      campaign_name: 'Spring Launch 2026',
      status: 'active',
      scans: 1842,
      unique_scans: 1204,
      created_at: '2026-01-15T10:00:00Z',
      last_scan: '2026-05-01T14:32:00Z',
      style: { foreground: '#1a1a2e', background: '#ffffff', logo: true },
      protocol: 'QRON'
    },
    {
      id: 'qr_002',
      name: 'Event Check-In',
      url: 'https://events.example.com/checkin',
      short_url: 'https://qron.space/r/def456',
      type: 'event',
      campaign_id: 'camp_002',
      campaign_name: 'Conference 2026',
      status: 'active',
      scans: 523,
      unique_scans: 498,
      created_at: '2026-03-01T09:00:00Z',
      last_scan: '2026-04-15T18:00:00Z',
      style: { foreground: '#0d6efd', background: '#ffffff', logo: false },
      protocol: 'QRON'
    },
    {
      id: 'qr_003',
      name: 'Social Media Link',
      url: 'https://linktree.example.com/brand',
      short_url: 'https://qron.space/r/ghi789',
      type: 'social',
      campaign_id: null,
      campaign_name: null,
      status: 'paused',
      scans: 341,
      unique_scans: 289,
      created_at: '2025-12-01T12:00:00Z',
      last_scan: '2026-02-20T10:15:00Z',
      style: { foreground: '#6f42c1', background: '#ffffff', logo: true },
      protocol: 'QRON'
    }
  ];

  let filtered = codes;
  if (status) filtered = filtered.filter(c => c.status === status);
  if (campaign_id) filtered = filtered.filter(c => c.campaign_id === campaign_id);
  if (type) filtered = filtered.filter(c => c.type === type);

  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    success: true,
    codes: paginated,
    total: filtered.length,
    active: filtered.filter(c => c.status === 'active').length,
    paused: filtered.filter(c => c.status === 'paused').length,
    total_scans: filtered.reduce((s, c) => s + c.scans, 0),
    page,
    limit,
    protocol: 'QRON'
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, url, type = 'url', campaign_id, style } = body;
  if (!name || !url) {
    return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
  }
  const newCode = {
    id: `qr_${Date.now()}`,
    name, url,
    short_url: `https://qron.space/r/${Math.random().toString(36).slice(2, 8)}`,
    type,
    campaign_id: campaign_id || null,
    status: 'active',
    scans: 0,
    unique_scans: 0,
    created_at: new Date().toISOString(),
    last_scan: null,
    style: style || { foreground: '#000000', background: '#ffffff', logo: false },
    protocol: 'QRON'
  };
  return NextResponse.json({ success: true, code: newCode, message: 'QR code created' }, { status: 201 });
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
