import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({
    success: true,
    endpoint: '/api/domains',
    domains: [
      { id: 'dom_001', domain: 'qr.luxebrand.com', status: 'active', qrons: 1200, verified: true },
      { id: 'dom_002', domain: 'scan.pharmaplus.com', status: 'active', qrons: 800, verified: true },
      { id: 'dom_003', domain: 'links.mycorp.io', status: 'pending', qrons: 0, verified: false },
    ],
    total: 3,
    custom_domain_limit: 10,
    protocol: 'QRON',
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    success: true,
    endpoint: '/api/domains',
    domain: {
      id: `dom_${Date.now()}`,
      domain: body.domain || 'example.com',
      status: 'pending',
      verified: false,
      dns_records: [
        { type: 'CNAME', name: 'qr', value: 'cname.qron.space' },
      ],
      created_at: new Date().toISOString(),
    },
    message: 'Domain added. Please configure DNS records to verify.',
    protocol: 'QRON',
  });
}
