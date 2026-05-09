import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const action = searchParams.get('action');
  const resource = searchParams.get('resource');
  const limit = parseInt(searchParams.get('limit') || '50');

  const auditLogs = [
    {
      id: 'audit_001',
      user_id: 'user_001',
      action: 'qr_created',
      resource: 'qr_code',
      resource_id: 'qr_abc123',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      metadata: { name: 'Product Landing Page QR', url: 'https://example.com/product' },
      created_at: new Date(Date.now() - 1 * 3600000).toISOString()
    },
    {
      id: 'audit_002',
      user_id: 'user_001',
      action: 'qr_updated',
      resource: 'qr_code',
      resource_id: 'qr_abc123',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      metadata: { field: 'destination_url', old: 'https://example.com/v1', new: 'https://example.com/product' },
      created_at: new Date(Date.now() - 30 * 60000).toISOString()
    },
    {
      id: 'audit_003',
      user_id: 'user_002',
      action: 'campaign_created',
      resource: 'campaign',
      resource_id: 'camp_001',
      ip_address: '10.0.0.5',
      user_agent: 'Mozilla/5.0',
      metadata: { name: 'Summer Product Launch', qr_count: 0 },
      created_at: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    {
      id: 'audit_004',
      user_id: 'user_001',
      action: 'api_key_created',
      resource: 'api_key',
      resource_id: 'key_001',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      metadata: { name: 'Production Key', permissions: ['read', 'write'] },
      created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      id: 'audit_005',
      user_id: 'user_002',
      action: 'login',
      resource: 'auth',
      resource_id: 'user_002',
      ip_address: '10.0.0.5',
      user_agent: 'Mobile Safari',
      metadata: { method: 'email', success: true },
      created_at: new Date(Date.now() - 6 * 3600000).toISOString()
    }
  ];

  let filtered = auditLogs;
  if (user_id) filtered = filtered.filter(l => l.user_id === user_id);
  if (action) filtered = filtered.filter(l => l.action === action);
  if (resource) filtered = filtered.filter(l => l.resource === resource);

  return NextResponse.json({
    success: true,
    logs: filtered.slice(0, limit),
    total: filtered.length,
    actions: ['qr_created', 'qr_updated', 'qr_deleted', 'campaign_created', 'campaign_updated', 'api_key_created', 'login', 'logout', 'subscription_changed', 'export'],
    resources: ['qr_code', 'campaign', 'template', 'api_key', 'auth', 'billing', 'webhook']
  });
}
