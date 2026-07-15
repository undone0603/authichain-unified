import { NextRequest, NextResponse } from 'next/server';

const auditLogs = [
  { id: 'log_001', user_id: 'usr_001', action: 'qr_created', resource: 'QR Code', resource_id: 'qr_abc123', details: 'Created QR code for product launch campaign', ip: '192.168.1.1', timestamp: '2025-01-15T10:30:00Z', platform: 'QRON' },
  { id: 'log_002', user_id: 'usr_001', action: 'qr_scanned', resource: 'QR Code', resource_id: 'qr_abc123', details: 'QR code scanned 47 times in last hour', ip: '10.0.0.5', timestamp: '2025-01-15T11:00:00Z', platform: 'QRON' },
  { id: 'log_003', user_id: 'usr_002', action: 'api_key_created', resource: 'API Key', resource_id: 'key_xyz789', details: 'New API key generated for integration', ip: '172.16.0.10', timestamp: '2025-01-15T09:15:00Z', platform: 'QRON' },
  { id: 'log_004', user_id: 'usr_001', action: 'subscription_upgraded', resource: 'Subscription', resource_id: 'sub_001', details: 'Upgraded from Starter to Pro plan', ip: '192.168.1.1', timestamp: '2025-01-14T14:00:00Z', platform: 'QRON' },
  { id: 'log_005', user_id: 'usr_002', action: 'team_member_added', resource: 'Team', resource_id: 'team_001', details: 'Added john@company.com to workspace', ip: '172.16.0.10', timestamp: '2025-01-14T16:30:00Z', platform: 'QRON' }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const action = searchParams.get('action');
  const limit = parseInt(searchParams.get('limit') || '50');

  let filtered = auditLogs;
  if (user_id) filtered = filtered.filter(l => l.user_id === user_id);
  if (action) filtered = filtered.filter(l => l.action === action);
  filtered = filtered.slice(0, limit);

  return NextResponse.json({
    success: true,
    endpoint: '/api/audit',
    audit_logs: filtered,
    total: filtered.length,
    platform: 'QRON'
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { user_id, action, resource, resource_id, details } = body;

  if (!user_id || !action) {
    return NextResponse.json({ error: 'user_id and action are required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    audit_log: {
      id: `log_${Date.now()}`,
      user_id, action, resource, resource_id, details,
      timestamp: new Date().toISOString(),
      platform: 'QRON'
    },
    platform: 'QRON'
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
