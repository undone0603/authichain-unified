import { NextRequest, NextResponse } from 'next/server';

const qrCodes = [
  { id: 'qr_001', name: 'Product Launch Campaign', url: 'https://example.com/launch', type: 'url', scans: 8420, created_at: '2025-01-01T00:00:00Z', tags: ['marketing', 'launch'], active: true },
  { id: 'qr_002', name: 'Menu QR Code', url: 'https://restaurant.com/menu', type: 'url', scans: 5300, created_at: '2025-01-05T00:00:00Z', tags: ['restaurant', 'menu'], active: true },
  { id: 'qr_003', name: 'Business Card', url: 'https://johnsmith.com', type: 'vcard', scans: 1240, created_at: '2024-12-10T00:00:00Z', tags: ['personal', 'networking'], active: true },
  { id: 'qr_004', name: 'WiFi Access', url: null, type: 'wifi', scans: 890, created_at: '2024-12-15T00:00:00Z', tags: ['office', 'wifi'], active: false },
  { id: 'qr_005', name: 'Product Authenticator', url: 'https://authichain.com/verify/SKU-001', type: 'url', scans: 3200, created_at: '2025-01-10T00:00:00Z', tags: ['authentication', 'product'], active: true }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type');
  const tag = searchParams.get('tag');
  const active = searchParams.get('active');

  let results = qrCodes;
  if (q) results = results.filter(qr =>
    qr.name.toLowerCase().includes(q.toLowerCase()) ||
    (qr.url && qr.url.toLowerCase().includes(q.toLowerCase())) ||
    qr.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))
  );
  if (type) results = results.filter(qr => qr.type === type);
  if (tag) results = results.filter(qr => qr.tags.includes(tag));
  if (active !== null && active !== undefined) results = results.filter(qr => qr.active === (active === 'true'));

  return NextResponse.json({
    success: true,
    endpoint: '/api/search',
    query: q,
    results,
    total: results.length,
    types_found: [...new Set(results.map(r => r.type))],
    platform: 'QRON'
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
