import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { provisionPurchase } from '@/lib/provisioning';
import { renderBillingEmail } from '@/lib/billing-emails';
import { getBrandIdFromMetadata } from '@/lib/brand-billing';
import { sendEmail } from '@/lib/email';
import { onNewSubscription, onPaymentFailed } from '@/server/revenue-engine/loop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFERRAL_REWARD_CREDITS = 100;

/**
 * Credit a user-to-user referrer with account credit on the referred buyer's
 * first paid conversion. `ref_code` is the referrer's profile id (issued by
 * ReferralTracker). Idempotent via the user_referrals table.
 */
async function creditReferral(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  refCode: string | undefined,
  referredEmail: string | null,
  brand: string,
): Promise<void> {
  if (!refCode || !referredEmail) return;
  const email = referredEmail.toLowerCase().trim();
  if (refCode === email) return; // can't refer yourself by email

  try {
    const { data: existing } = await supabase
      .from('user_referrals')
      .select('id, status')
      .eq('ref_code', refCode)
      .eq('referred_email', email)
      .maybeSingle();
    if (existing && (existing.status === 'converted' || existing.status === 'rewarded')) {
      return; // already credited
    }

    const { data: referrer } = await supabase
      .from('profiles')
      .select('id, generations_limit')
      .eq('id', refCode)
      .maybeSingle();

    if (referrer?.id) {
      await supabase
        .from('profiles')
        .update({ generations_limit: Number(referrer.generations_limit ?? 0) + REFERRAL_REWARD_CREDITS })
        .eq('id', referrer.id);
    }

    await supabase.from('user_referrals').insert({
      ref_code: refCode,
      referrer_id: referrer?.id ?? null,
      referred_email: email,
      brand,
      status: 'rewarded',
      reward_credits: REFERRAL_REWARD_CREDITS,
      converted_at: new Date().toISOString(),
      rewarded_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[webhook] referral credit failed:', e);
  }
}

// Lazy singletons — avoid build-time throw when env vars are absent.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' as const });
  }
  return _stripe;
}

let _supabase: ReturnType<typeof createClient> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

export async function POST(req: NextRequest) {
  // Single canonical endpoint for the whole (single-account) ecosystem. Accept
  // either signing secret so consolidation doesn't depend on which secret the
  // live Stripe endpoint was registered with. Brand is read from event metadata,
  // not from the endpoint.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET,
  ].filter((s): s is string => !!s);

  if (!process.env.STRIPE_SECRET_KEY || secrets.length === 0) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = getStripe();

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: any = null;
  let lastErr = '';
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret);
      break;
    } catch (err: any) {
      lastErr = err.message;
    }
  }
  if (!event) {
    console.error('Stripe webhook signature verification failed:', lastErr);
    return NextResponse.json({ error: `Webhook Error: ${lastErr}` }, { status: 400 });
  }

  // Idempotency: Stripe retries deliveries. Skip events we've already recorded
  // so commission accrual and other side effects run at most once per event.
  try {
    const { data: seen } = await getSupabase()
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch {
    // Dedup check unavailable — fall through and process (at-least-once).
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const md = session.metadata || {};
        const userId = md.user_id;
        const plan = md.plan;
        const brand = getBrandIdFromMetadata(md);
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        const isTrial = md.trial === 'true';
        const grantRaw = md.grant;
        const grantParsed = grantRaw ? parseInt(grantRaw, 10) : NaN;
        const generationsGrant = Number.isNaN(grantParsed) ? undefined : grantParsed;
        const email = session.customer_email || session.customer_details?.email || null;

        // Hands-off provisioning for BOTH authenticated and guest checkouts.
        // Guests get a profile created/resolved by email so the purchase is
        // never lost.
        const prov = await provisionPurchase(getSupabase(), {
          email,
          userId,
          plan,
          brand,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          isTrial,
          generationsGrant,
        });

        if (prov.profileId) {
          await getSupabase().from('checkout_sessions').update({ status: 'completed' })
            .eq('session_id', session.id);

          // Brand-aware welcome email (replaces the cross-call to /api/email).
          if (email) {
            const mail = renderBillingEmail('subscription_confirmed', brand, { planName: plan || undefined });
            await sendEmail({ to: email, from: mail.from, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => {});
          }
        }

        // complete_checkout funnel event — success is only known here.
        if (md.prospect_id) {
          try {
            await getSupabase().from('funnel_events').insert({
              prospect_id: md.prospect_id,
              stage: 'complete_checkout',
              source: md.source || 'direct',
              metadata: { plan, brand },
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            console.error('[webhook] complete_checkout funnel insert failed:', e);
          }
        }

        // User-to-user referral account credit (first paid conversion).
        if (typeof session.amount_total === 'number' && session.amount_total > 0) {
          await creditReferral(getSupabase(), md.ref_code, email, brand);
        }

        // Affiliate commission accrual — credit the referring affiliate's
        // pending_payout when the buyer arrived via an affiliate code.
        // Runs independently of userId (guest checkouts can still be referred).
        const affiliateCode = session.metadata?.affiliate_code;
        if (affiliateCode && typeof session.amount_total === 'number' && session.amount_total > 0) {
          try {
            const { data: aff } = await getSupabase()
              .from('affiliates')
              .select('id, pending_payout, total_referrals, total_conversions, commission_rate, status')
              .eq('affiliatecode', affiliateCode)
              .maybeSingle();

            if (aff && aff.status === 'active') {
              const gross = session.amount_total / 100;
              const rate = Number(aff.commission_rate ?? 0.1);
              const commission = Math.round(gross * rate * 100) / 100;
              if (commission > 0) {
                await getSupabase()
                  .from('affiliates')
                  .update({
                    pending_payout: Number(aff.pending_payout ?? 0) + commission,
                    total_referrals: Number(aff.total_referrals ?? 0) + 1,
                    total_conversions: Number(aff.total_conversions ?? 0) + 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', aff.id)
                  .eq('pending_payout', aff.pending_payout ?? 0);
              }
            }
          } catch (e) {
            console.error('[webhook] affiliate accrual failed:', e);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const amountPaid = invoice.amount_paid / 100;

        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await getSupabase().from('profiles').update({
            subscription_status: 'active',
            last_payment_at: new Date().toISOString(),
          }).eq('id', profile.id);

          await getSupabase().from('payment_history').insert({
            user_id: profile.id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subscriptionId,
            amount: amountPaid,
            currency: invoice.currency,
            status: 'paid',
            paid_at: new Date().toISOString(),
          });
        }

        // Recurring affiliate commission — credit on renewals only.
        // The first payment is handled by checkout.session.completed, so we skip
        // billing_reason 'subscription_create' here to avoid double-counting.
        // Event-level idempotency (stripe_events) prevents re-crediting a retry.
        if (invoice.billing_reason === 'subscription_cycle' && subscriptionId && invoice.amount_paid > 0) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const affiliateCode = sub.metadata?.affiliate_code;
            if (affiliateCode) {
              const { data: aff } = await getSupabase()
                .from('affiliates')
                .select('id, pending_payout, commission_rate, status')
                .eq('affiliatecode', affiliateCode)
                .maybeSingle();
              if (aff && aff.status === 'active') {
                const rate = Number(aff.commission_rate ?? 0.1);
                const commission = Math.round((invoice.amount_paid / 100) * rate * 100) / 100;
                if (commission > 0) {
                  await getSupabase()
                    .from('affiliates')
                    .update({
                      pending_payout: Number(aff.pending_payout ?? 0) + commission,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', aff.id)
                    .eq('pending_payout', aff.pending_payout ?? 0);
                }
              }
            }
          } catch (e) {
            console.error('[webhook] recurring affiliate accrual failed:', e);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('id, email, full_name, brand, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single() as any;

        if (profile) {
          await getSupabase().from('profiles').update({
            subscription_status: 'past_due',
          }).eq('id', profile.id);

          if (profile.email) {
            const brand = getBrandIdFromMetadata({ brand: profile.brand });
            const mail = renderBillingEmail('payment_failed', brand, {
              name: profile.full_name || undefined,
              planName: profile.subscription_plan || undefined,
            });
            await sendEmail({ to: profile.email, from: mail.from, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => {});
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await getSupabase().from('profiles').update({
          subscription_status: 'cancelled',
          subscription_plan: 'free',
          cancelled_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        await getSupabase().from('profiles').update({
          subscription_status: status,
          stripe_subscription_id: subscription.id,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('id, email, full_name, brand, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single() as any;

        if (profile?.email) {
          const brand = getBrandIdFromMetadata({ brand: profile.brand });
          const mail = renderBillingEmail('trial_expiring', brand, {
            name: profile.full_name || undefined,
            planName: profile.subscription_plan || undefined,
            days: 3,
          });
          await sendEmail({ to: profile.email, from: mail.from, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => {});
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    // Log all events
    await getSupabase().from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    }).select();

    return NextResponse.json({ received: true, type: event.type });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
