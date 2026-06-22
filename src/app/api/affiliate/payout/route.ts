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
 * Processes all pending affiliate_payouts by transferring via Stripe Connect.
 * Called by the autonomous controller daily cycle and by admin webhooks.
 * Requires STRIPE_CONNECT_ENABLED=true and each affiliate to have a
 * stripe_account_id stored on their profile.
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

  // Fetch all pending payouts with their affiliate's Stripe account
  const { data: pending, error: fetchErr } = await admin
    .from('affiliate_payouts')
    .select(`
      id,
      affiliate_id,
      amount,
      metadata,
      profiles!affiliate_id (
        stripe_account_id,
        email
      )
    `)
    .eq('status', 'pending')
    .limit(50);

  if (fetchErr) {
    await logAutomation('affiliate_payout_processor', 'event', 'failure', null, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No pending payouts' });
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const payout of pending) {
    const profile = Array.isArray(payout.profiles) ? payout.profiles[0] : payout.profiles;
    const stripeAccountId = (profile as { stripe_account_id?: string } | null)?.stripe_account_id;

    // Without a connected Stripe account, queue for manual review
    if (!stripeAccountId) {
      await admin
        .from('affiliate_payouts')
        .update({ status: 'needs_review', updated_at: new Date().toISOString() })
        .eq('id', payout.id);
      failed++;
      errors.push(`affiliate ${payout.affiliate_id}: no stripe_account_id`);
      continue;
    }

    const amountCents = Math.round(parseFloat(payout.amount) * 100);
    if (amountCents < 100) {
      // Stripe minimum transfer is $1 — accumulate micro-amounts
      await admin
        .from('affiliate_payouts')
        .update({ status: 'held_minimum', updated_at: new Date().toISOString() })
        .eq('id', payout.id);
      failed++;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: stripeAccountId,
        metadata: {
          payout_id: String(payout.id),
          affiliate_id: String(payout.affiliate_id),
          source: 'authichain_affiliate_program',
        },
      });

      await admin
        .from('affiliate_payouts')
        .update({
          status: 'paid',
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from('affiliate_payouts')
        .update({
          status: 'failed',
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id);
      failed++;
      errors.push(`payout ${payout.id}: ${msg}`);
    }
  }

  const status = succeeded > 0 || failed === 0 ? 'success' : 'failure';
  await logAutomation('affiliate_payout_processor', 'event', status, { processed: pending.length, succeeded, failed });

  return NextResponse.json({ ok: true, processed: pending.length, succeeded, failed, errors });
}
