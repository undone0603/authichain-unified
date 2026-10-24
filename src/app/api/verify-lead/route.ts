import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = (form.get('email') as string | null)?.trim().toLowerCase();
  const consent = form.get('consent');
  const productId = form.get('productId');
  const status = form.get('status');

  if (!consent || !email || !email.includes('@')) {
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

  // Insert into leads table (uses existing anon client; requires RLS policy allowing public insert of consented emails)
  const supabase = await createClient();
  const { error } = await supabase
    .from('leads')
    .insert({
      email,
      source: 'verify_page',
      product_id: productId ? Number(productId) : null,
      status: status || 'unverified',
      consent: true,
      captured_at: new Date().toISOString(),
    });

  if (error) {
    console.error(JSON.stringify({
      event: 'verify_lead_insert_failed',
      error: error.message,
      email,
      productId,
    }));
    // Non-blocking: still redirect so user is not stuck
  }

  // AgentZ handoff (dry-run only until wired):
  // python -m agentz.cli run verify-lead-capture --mode dry-run

  return NextResponse.redirect(new URL(`/onboard?from=verify&product=${productId || ''}`, req.url));
}
