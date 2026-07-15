import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');

  const api_keys = [
    {
      id: 'key_001',
      user_id: 'user_001',
      name: 'Production API Key',
      key_prefix: 'qron_live_sk_',
      key_preview: 'qron_live_sk_...a4f2',
      scopes: ['qr:read', 'qr:write', 'scan:read', 'analytics:read'],
      environment: 'production',
      status: 'active',
      rate_limit: 1000,
      rate_limit_window: '1h',
      total_requests: 45230,
      last_used: new Date(Date.now() - 300000).toISOString(),
      expires_at: null,
      created_at: '2025-01-10T00:00:00Z'
    },
    {
      id: 'key_002',
      user_id: 'user_001',
      name: 'Development API Key',
      key_prefix: 'qron_test_sk_',
      key_preview: 'qron_test_sk_...b8c3',
      scopes: ['qr:read', 'qr:write', 'scan:read', 'analytics:read', 'webhook:write'],
      environment: 'test',
      status: 'active',
      rate_limit: 100,
      rate_limit_window: '1h',
      total_requests: 1842,
      last_used: new Date(Date.now() - 3600000).toISOString(),
      expires_at: '2026-01-10T00:00:00Z',
      created_at: '2025-01-10T00:00:00Z'
    },
    {
      id: 'key_003',
      user_id: 'user_001',
      name: 'Zapier Integration Key',
      key_prefix: 'qron_live_sk_',
      key_preview: 'qron_live_sk_...d1e9',
      scopes: ['qr:read', 'scan:read'],
      environment: 'production',
      status: 'revoked',
      rate_limit: 500,
      rate_limit_window: '1h',
      total_requests: 892,
      last_used: new Date(Date.now() - 30 * 86400000).toISOString(),
      expires_at: null,
      created_at: '2024-11-01T00:00:00Z',
      revoked_at: new Date(Date.now() - 7 * 86400000).toISOString()
    }
  ];

  let filtered = api_keys;
  if (user_id) filtered = filtered.filter(k => k.user_id === user_id);

  const available_scopes = [
    'qr:read', 'qr:write', 'qr:delete',
    'scan:read', 'analytics:read',
    'campaign:read', 'campaign:write',
    'webhook:read', 'webhook:write',
    'billing:read', 'user:read'
  ];

  return NextResponse.json({
    success: true,
    api_keys: filtered,
    total: filtered.length,
    active_count: filtered.filter(k => k.status === 'active').length,
    available_scopes,
    generated_at: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user_id, name, scopes, environment, expires_at } = body;

  if (!user_id || !name || !scopes) {
    return NextResponse.json({ success: false, error: 'user_id, name, and scopes are required' }, { status: 400 });
  }

  const prefix = environment === 'test' ? 'qron_test_sk_' : 'qron_live_sk_';
  const raw_key = prefix + randomBytes(24).toString('hex');

  return NextResponse.json({
    success: true,
    api_key: {
      id: `key_${Date.now()}`,
      user_id,
      name,
      key: raw_key,
      key_preview: raw_key.substring(0, raw_key.length - 4) + '...' + raw_key.slice(-4),
      scopes,
      environment: environment || 'production',
      status: 'active',
      rate_limit: 1000,
      rate_limit_window: '1h',
      total_requests: 0,
      last_used: null,
      expires_at: expires_at || null,
      created_at: new Date().toISOString()
    },
    warning: 'Save this key securely. It will not be shown again.',
    created_at: new Date().toISOString()
  }, { status: 201 });
}
