import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase';

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase is not configured' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const settlementId = body.settlementId as string | undefined;
  if (!settlementId) return NextResponse.json({ ok: false, error: 'settlementId is required' }, { status: 400 });

  const { data: settlement, error } = await supabase.from('claimpilot_settlements').select('*').eq('id', settlementId).single();
  if (error || !settlement) return NextResponse.json({ ok: false, error: error?.message ?? 'Settlement not found' }, { status: 404 });

  const official = Boolean(settlement.official_url && settlement.claim_url && settlement.administrator);
  const verified = Boolean(official && settlement.last_verified_at);
  const nextStatus = verified ? 'open' : 'verifying';
  await supabase.from('claimpilot_settlements').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', settlementId);

  return NextResponse.json({ ok: true, verified, status: nextStatus, checks: {
    officialAdministrator: Boolean(settlement.administrator),
    officialSettlementUrl: Boolean(settlement.official_url),
    officialClaimUrl: Boolean(settlement.claim_url),
    lastVerified: settlement.last_verified_at ?? null,
  }});
}
