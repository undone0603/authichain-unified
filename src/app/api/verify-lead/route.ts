import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = form.get('email') as string | null;
  const consent = form.get('consent');
  const productId = form.get('productId');
  const status = form.get('status');

  if (!consent || !email) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  // Structured event for AgentZ / observability
  console.log(JSON.stringify({
    event: 'verify_email_captured',
    email,
    productId,
    status,
    ts: new Date().toISOString(),
    source: 'vercel_verify_page',
  }));

  // TODO: queue to AgentZ workflow or insert Supabase leads (human: add secret / table)
  // AgentZ dry-run example: python -m agentz.cli run verify-lead-capture --mode dry-run

  return NextResponse.redirect(new URL('/onboard?from=verify&product=' + productId, req.url));
}
