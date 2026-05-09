import { NextRequest, NextResponse } from 'next/server';

// GET /api/v1/webhook - List registered webhooks
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const event_type = searchParams.get('event_type');
  const status = searchParams.get('status');

  const webhooks = [
    {
      id: 'wh_001',
      user_id: 'usr_001',
      name: 'Scan Notification',
      url: 'https://api.example.com/webhooks/qron-scan',
      event_types: ['qr.scanned', 'qr.scanned.unique'],
      status: 'active',
      secret: 'whsec_***masked***',
      created_at: '2026-01-15T10:00:00Z',
      last_triggered: '2026-05-10T14:30:00Z',
      success_count: 1420,
      failure_count: 3,
      retry_count: 3,
      timeout_ms: 5000
    },
    {
      id: 'wh_002',
      user_id: 'usr_001',
      name: 'Campaign Analytics',
      url: 'https://api.example.com/webhooks/qron-analytics',
      event_types: ['campaign.completed', 'campaign.milestone'],
      status: 'active',
      secret: 'whsec_***masked***',
      created_at: '2026-02-20T09:00:00Z',
      last_triggered: '2026-05-09T18:00:00Z',
      success_count: 42,
      failure_count: 0,
      retry_count: 3,
      timeout_ms: 10000
    },
    {
      id: 'wh_003',
      user_id: 'usr_002',
      name: 'QR Generated Alert',
      url: 'https://hooks.slack.com/services/T00/B00/xxx',
      event_types: ['qr.created', 'qr.updated'],
      status: 'inactive',
      secret: 'whsec_***masked***',
      created_at: '2026-03-10T11:00:00Z',
      last_triggered: null,
      success_count: 0,
      failure_count: 0,
      retry_count: 3,
      timeout_ms: 5000
    }
  ];

  let filtered = webhooks;
  if (user_id) filtered = filtered.filter(w => w.user_id === user_id);
  if (event_type) filtered = filtered.filter(w => w.event_types.includes(event_type));
  if (status) filtered = filtered.filter(w => w.status === status);

  return NextResponse.json({
    success: true,
    webhooks: filtered,
    total: filtered.length,
    available_events: [
      'qr.created', 'qr.updated', 'qr.deleted',
      'qr.scanned', 'qr.scanned.unique',
      'campaign.created', 'campaign.completed', 'campaign.milestone',
      'subscription.created', 'subscription.cancelled'
    ],
    generated_at: new Date().toISOString()
  });
}

// POST /api/v1/webhook - Register new webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, url, event_types, user_id } = body;

    if (!name || !url || !event_types || !user_id) {
      return NextResponse.json({ error: 'Missing required fields: name, url, event_types, user_id' }, { status: 400 });
    }

    const webhook = {
      id: `wh_${Date.now()}`,
      user_id,
      name,
      url,
      event_types,
      status: 'active',
      secret: `whsec_${Math.random().toString(36).substring(2, 18)}`,
      created_at: new Date().toISOString(),
      last_triggered: null,
      success_count: 0,
      failure_count: 0,
      retry_count: 3,
      timeout_ms: 5000
    };

    return NextResponse.json({ success: true, webhook }, { status: 201 });
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
