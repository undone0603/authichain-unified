import { NextResponse } from 'next/server';

// POST /api/v1/scan - Record a scan event
export async function POST(req: Request) {
  const body = await req.json();
  const { qron_id, ip, user_agent, country, city, device_type, referrer } = body;

  if (!qron_id) {
    return NextResponse.json({ error: 'qron_id is required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    api_version: 'v1',
    scan: {
      id: `scan_${Date.now()}`,
      qron_id,
      ip: ip || '0.0.0.0',
      user_agent: user_agent || 'unknown',
      country: country || 'US',
      city: city || 'Unknown',
      device_type: device_type || 'mobile',
      referrer: referrer || null,
      timestamp: new Date().toISOString(),
    },
    destination_url: `https://example.com/product/${qron_id}`,
    protocol: 'QRON',
  }, { status: 201 });
}

// GET /api/v1/scan - Get scan history for a QR code
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qron_id = searchParams.get('qron_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  return NextResponse.json({
    success: true,
    api_version: 'v1',
    qron_id,
    scans: [
      { id: 'scan_001', country: 'US', city: 'New York', device_type: 'mobile', timestamp: '2026-05-08T12:00:00Z' },
      { id: 'scan_002', country: 'GB', city: 'London', device_type: 'mobile', timestamp: '2026-05-08T13:00:00Z' },
      { id: 'scan_003', country: 'CA', city: 'Toronto', device_type: 'desktop', timestamp: '2026-05-08T14:00:00Z' },
    ],
    total: 3,
    date_range: { from: from || '2026-05-01', to: to || '2026-05-09' },
    protocol: 'QRON',
  });
}
