import { NextRequest, NextResponse } from 'next/server';

const invoices = [
  { id: 'inv_001', user_id: 'usr_001', amount: 29.00, currency: 'usd', status: 'paid', plan: 'Pro', period_start: '2025-01-01T00:00:00Z', period_end: '2025-01-31T00:00:00Z', paid_at: '2025-01-01T10:00:00Z', pdf_url: 'https://qron.space/invoices/inv_001.pdf' },
  { id: 'inv_002', user_id: 'usr_002', amount: 79.00, currency: 'usd', status: 'paid', plan: 'Business', period_start: '2025-01-01T00:00:00Z', period_end: '2025-01-31T00:00:00Z', paid_at: '2025-01-01T09:00:00Z', pdf_url: 'https://qron.space/invoices/inv_002.pdf' },
  { id: 'inv_003', user_id: 'usr_001', amount: 29.00, currency: 'usd', status: 'open', plan: 'Pro', period_start: '2025-02-01T00:00:00Z', period_end: '2025-02-28T00:00:00Z', paid_at: null, due_date: '2025-02-05T00:00:00Z', pdf_url: null }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const status = searchParams.get('status');
  const id = searchParams.get('id');

  if (id) {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ success: true, invoice, platform: 'QRON' });
  }

  let filtered = invoices;
  if (user_id) filtered = filtered.filter(i => i.user_id === user_id);
  if (status) filtered = filtered.filter(i => i.status === status);

  return NextResponse.json({
    success: true,
    endpoint: '/api/invoice',
    invoices: filtered,
    total: filtered.length,
    total_paid: filtered.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    outstanding: filtered.filter(i => i.status === 'open').reduce((s, i) => s + i.amount, 0),
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
