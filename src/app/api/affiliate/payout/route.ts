import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { logAutomation } from '@/lib/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' as const });
}

/**
 * POST /api/affiliate/payout
 *
 * Pays out accrued affiliate commissions via Stripe Connect.
 *
 * Source of truth is the `affiliates` table: any affiliate with
 * pending_payout >= the Stripe minimum and a connected Stripe account
 * (profiles.stripe_account_id) is paid, an audit row is written to
 * affiliate_payouts, and pending_payout is reset.
 *
 * Safety:
 *  - Gated behind STRIPE_CONNECT_ENABLED=true.
 *  - Stripe idempotency key (affiliate + amount + day) prevents a duplicate
 *    transfer if the job runs twice in a day.
 *  - The pending_payout reset is guarded on the exact amount read, so a
 *    concurrent accrual is never silently zeroed.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.STRIPE_CONNECT_ENABLED !== 'true') {
    return NextResponse.json({ ok: false, message: 'Stripe Connect not enabled — payouts skipped' });
  }

  const admin = getAdmin();
  const stripe = getStripe();
  const day = new Date().toISOString().slice(0, 10);

  // Affiliates with money owed
  const { data: owed, error: fetchErr } = await admin
    .from('affiliates')
    .select('id, user_id, affiliatecode, pending_payout, total_earnings, status')
    .eq('status', 'active')
    .gt('pending_payout', 0)
    .limit(100);

  if (fetchErr) {
    await logAutomation('affiliate_payout_processor', 'event', 'failure', null, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!owed || owed.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No affiliates with pending payout' });
  }

  let paid = 0, needsReview = 0, heldMinimum = 0, failed = 0;
  const errors: string[] = [];

  for (const a of owed) {
    const amount = parseFloat(a.pending_payout as unknown as string);
    const amountCents = Math.round(amount * 100);

    // Resolve the affiliate's connected Stripe account from their profile
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id, email')
      .eq('id', a.user_id)
      .maybeSingle();
    const stripeAccountId = (profile as { stripe_account_id?: string } | null)?.stripe_account_id;

    if (!stripeAccountId) {
      await admin.from('affiliate_payouts').insert({
        affiliate_id: String(a.user_id), amount, currency: 'usd', status: 'needs_review',
        metadata: { affiliate_table_id: a.id, affiliatecode: a.affiliatecode, reason: 'no_stripe_account' },
      });
      needsReview++;
      continue;
    }

    if (amountCents < 100) { // Stripe minimum transfer is $1
      heldMinimum++;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency: 'usd',
          destination: stripeAccountId,
          metadata: { affiliate_table_id: String(a.id), user_id: String(a.user_id), source: 'authichain_affiliate' },
        },
        { idempotencyKey: `affpayout_${a.id}_${amountCents}_${day}` },
      );

      await admin.from('affiliate_payouts').insert({
        affiliate_id: String(a.user_id), amount, currency: 'usd', status: 'paid',
        stripe_transfer_id: transfer.id, paid_at: new Date().toISOString(),
        metadata: { affiliate_table_id: a.id, affiliatecode: a.affiliatecode },
      });

      // Reset pending_payout, guarded on the exact amount we just paid so a
      // concurrent accrual isn't lost.
      await admin
        .from('affiliates')
        .update({
          pending_payout: 0,
          total_earnings: (parseFloat((a.total_earnings as unknown as string) || '0')) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', a.id)
        .eq('pending_payout', a.pending_payout);

      paid++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin.from('affiliate_payouts').insert({
        affiliate_id: String(a.user_id), amount, currency: 'usd', status: 'failed',
        error_message: msg, metadata: { affiliate_table_id: a.id },
      });
      failed++;
      errors.push(`affiliate ${a.id}: ${msg}`);
    }
  }

  const status = failed > 0 && paid === 0 ? 'failure' : 'success';
  await logAutomation('affiliate_payout_processor', 'event', status,
    { processed: owed.length, paid, needsReview, heldMinimum, failed });

  return NextResponse.json({ ok: true, processed: owed.length, paid, needsReview, heldMinimum, failed, errors });
}
