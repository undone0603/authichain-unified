import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const status = searchParams.get('status');

  const domains = [
    {
      id: 'dom_001',
      user_id: 'user_001',
      domain: 'scan.mybrand.com',
      type: 'custom',
      status: 'active',
      verified: true,
      ssl_enabled: true,
      dns_records: [
        { type: 'CNAME', name: 'scan', value: 'cname.qron.space', ttl: 3600 }
      ],
      qr_codes_count: 47,
      created_at: '2025-01-10T00:00:00Z',
      verified_at: '2025-01-11T00:00:00Z'
    },
    {
      id: 'dom_002',
      user_id: 'user_001',
      domain: 'qr.acmecorp.io',
      type: 'custom',
      status: 'pending_verification',
      verified: false,
      ssl_enabled: false,
      dns_records: [
        { type: 'CNAME', name: 'qr', value: 'cname.qron.space', ttl: 3600 }
      ],
      qr_codes_count: 0,
      created_at: '2025-04-20T00:00:00Z',
      verified_at: null
    },
    {
      id: 'dom_003',
      user_id: 'user_002',
      domain: 'links.techstartup.com',
      type: 'custom',
      status: 'active',
      verified: true,
      ssl_enabled: true,
      dns_records: [
        { type: 'CNAME', name: 'links', value: 'cname.qron.space', ttl: 3600 }
      ],
      qr_codes_count: 123,
      created_at: '2024-11-05T00:00:00Z',
      verified_at: '2024-11-05T12:00:00Z'
    }
  ];

  let filtered = domains;
  if (user_id) filtered = filtered.filter(d => d.user_id === user_id);
  if (status) filtered = filtered.filter(d => d.status === status);

  return NextResponse.json({
    success: true,
    domains: filtered,
    total: filtered.length,
    statuses: ['active', 'pending_verification', 'inactive', 'error'],
    default_domain: 'qron.space',
    generated_at: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { domain, user_id } = body;

  if (!domain || !user_id) {
    return NextResponse.json({ success: false, error: 'domain and user_id are required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    domain: {
      id: `dom_${Date.now()}`,
      user_id,
      domain,
      type: 'custom',
      status: 'pending_verification',
      verified: false,
      ssl_enabled: false,
      dns_records: [
        { type: 'CNAME', name: domain.split('.')[0], value: 'cname.qron.space', ttl: 3600 }
      ],
      qr_codes_count: 0,
      created_at: new Date().toISOString(),
      verified_at: null
    },
    message: 'Domain added. Please configure DNS records to verify ownership.',
    created_at: new Date().toISOString()
  }, { status: 201 });
}
