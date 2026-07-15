import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { codes } = body;

  if (!Array.isArray(codes) || codes.length === 0) {
    return NextResponse.json({ error: 'codes array is required and must not be empty' }, { status: 400 });
  }

  if (codes.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 QR codes per bulk request' }, { status: 400 });
  }

  const results = codes.map((code: any, index: number) => {
    if (!code.name || !code.url) {
      return {
        index,
        success: false,
        error: 'name and url are required for each code',
        input: code
      };
    }
    return {
      index,
      success: true,
      qr_code: {
        id: `qr_bulk_${Date.now()}_${index}`,
        name: code.name,
        url: code.url,
        short_url: `https://qron.space/r/${Math.random().toString(36).slice(2, 8)}`,
        type: code.type || 'url',
        campaign_id: code.campaign_id || null,
        style: code.style || { foreground: '#000000', background: '#ffffff', logo: false },
        status: 'active',
        scans: 0,
        created_at: new Date().toISOString(),
        protocol: 'QRON'
      }
    };
  });

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return NextResponse.json({
    success: true,
    processed: codes.length,
    created: succeeded.length,
    failed: failed.length,
    results,
    batch_id: `batch_${Date.now()}`,
    protocol: 'QRON'
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batch_id = searchParams.get('batch_id');

  return NextResponse.json({
    success: true,
    endpoint: '/api/v1/bulk',
    description: 'Bulk QR code creation endpoint',
    max_per_request: 500,
    supported_operations: ['create'],
    example_request: {
      codes: [
        { name: 'Product 1', url: 'https://example.com/1', type: 'url' },
        { name: 'Product 2', url: 'https://example.com/2', type: 'url' }
      ]
    },
    protocol: 'QRON'
  });
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
