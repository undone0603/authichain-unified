import { NextResponse } from 'next/server';

// POST /api/v1/batch - Bulk create QR codes
export async function POST(req: Request) {
  const body = await req.json();
  const { items, style, campaign_id } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 });
  }

  if (items.length > 1000) {
    return NextResponse.json({ error: 'Maximum 1000 items per batch' }, { status: 400 });
  }

  const batchId = `batch_${Date.now()}`;
  const created = items.map((item: { url: string; label?: string }, index: number) => ({
    index,
    id: `qr_${Date.now()}_${index}`,
    url: item.url,
    label: item.label || null,
    short_url: `https://qron.space/q/qr_${Date.now()}_${index}`,
    qr_image_url: `https://qron.space/img/qr_${Date.now()}_${index}.png`,
    status: 'created',
  }));

  return NextResponse.json({
    success: true,
    api_version: 'v1',
    batch: {
      id: batchId,
      total: items.length,
      created: created.length,
      failed: 0,
      style: style || 'classic',
      campaign_id: campaign_id || null,
      download_url: `https://qron.space/batches/${batchId}.zip`,
      items: created,
      created_at: new Date().toISOString(),
    },
    protocol: 'QRON',
  }, { status: 201 });
}

// GET /api/v1/batch - List all batches
export async function GET() {
  return NextResponse.json({
    success: true,
    api_version: 'v1',
    batches: [
      { id: 'batch_001', total: 500, created: 500, status: 'completed', download_url: 'https://qron.space/batches/batch_001.zip', created_at: '2026-05-01T00:00:00Z' },
      { id: 'batch_002', total: 1000, created: 1000, status: 'completed', download_url: 'https://qron.space/batches/batch_002.zip', created_at: '2026-05-05T00:00:00Z' },
    ],
    total: 2,
    protocol: 'QRON',
  });
}
