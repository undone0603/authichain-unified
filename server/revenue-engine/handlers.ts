/**
 * Revenue Engine — Pure handler functions.
 * Each handler writes to Supabase, emits CRM tasks, and triggers Stripe checks.
 * All functions are side-effectful but isolated and testable.
 */
import type {
  VerificationEvent,
  CertificateMintedEvent,
  ScanEvent,
  SubscriptionCreatedEvent,
  PaymentFailedEvent,
} from './events';

// ---------------------------------------------------------------------------
// Supabase client (lazy singleton — works in Workers & Node)
// ---------------------------------------------------------------------------
function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---------------------------------------------------------------------------
// CRM client (thin wrapper — see server/crm/client.ts)
// ---------------------------------------------------------------------------
async function emitCrmTask(action: string, payload: Record<string, unknown>) {
  try {
    const { crmClient } = require('../crm/client');
    await crmClient.emit(action, payload);
  } catch (err) {
    console.error('[revenue-engine] CRM emit failed', action, err);
  }
}

// ---------------------------------------------------------------------------
// handleVerificationEvent
// ---------------------------------------------------------------------------
export async function handleVerificationEvent(event: VerificationEvent) {
  const supabase = getSupabase();

  // 1. Write to verification_events
  const { error: dbError } = await supabase.from('verification_events').insert({
    id: event.id,
    seal_id: event.seal_id,
    brand: event.brand,
    scan_context: event.scan_context,
    status: event.status,
    created_at: event.created_at,
  });
  if (dbError) console.error('[handleVerificationEvent] db insert failed', dbError);

  // 2. Log usage event for per-scan billing
  await supabase.from('usage_events').insert({
    event_type: 'verification',
    event_ref: event.id,
    brand: event.brand,
  });

  // 3. CRM: advance deal on valid scans
  if (event.status === 'valid') {
    await emitCrmTask('advanceDeal', {
      brand: event.brand,
      deal_type: event.brand === 'strainchain.io' ? 'StrainChain Pilot' : 'Brand Protection',
      metric: 'scan_volume',
      value: 1,
      ref_id: event.seal_id,
    });
  }
}

// ---------------------------------------------------------------------------
// handleCertificateMint
// ---------------------------------------------------------------------------
export async function handleCertificateMint(event: CertificateMintedEvent) {
  const supabase = getSupabase();

  // 1. Write to certificates (already inserted by /certificate Worker route,
  //    this handler adds post-mint side effects)
  await supabase.from('usage_events').insert({
    event_type: 'certificate_minted',
    event_ref: event.certificate_id,
    brand: event.brand,
  });

  // 2. CRM: create marketplace opportunity
  await emitCrmTask('createOpportunity', {
    brand: event.brand,
    deal_type: 'Certificate Marketplace',
    certificate_id: event.certificate_id,
    product_id: event.product_id,
    rarity_score: event.rarity_score,
    polygon_nft_tx: event.polygon_nft_tx,
  });
}

// ---------------------------------------------------------------------------
// handleDispensaryScan
// ---------------------------------------------------------------------------
export async function handleDispensaryScan(event: ScanEvent) {
  const supabase = getSupabase();

  await supabase.from('usage_events').insert({
    event_type: 'dispensary_scan',
    event_ref: event.batch_id as unknown as string,
    brand: event.brand,
  });

  // CRM: update StrainChain Pilot deal metrics
  await emitCrmTask('updateDealMetric', {
    brand: event.brand,
    deal_type: 'StrainChain Pilot',
    dispensary_id: event.dispensary_id,
    batch_id: event.batch_id,
    metric: 'scan_volume',
    value: 1,
  });
}

// ---------------------------------------------------------------------------
// handleSubscriptionCreated
// ---------------------------------------------------------------------------
export async function handleSubscriptionCreated(event: SubscriptionCreatedEvent) {
  const supabase = getSupabase();

  // 1. Upsert subscriptions row
  const { error } = await supabase.from('subscriptions').upsert(
    {
      id: event.id,
      stripe_customer_id: event.stripe_customer_id,
      stripe_subscription_id: event.stripe_subscription_id,
      plan_id: event.plan_id,
      brand: event.brand,
      email: event.email,
      status: 'active',
      current_period_end: event.current_period_end,
      created_at: event.created_at,
    },
    { onConflict: 'stripe_subscription_id' },
  );
  if (error) console.error('[handleSubscriptionCreated] upsert failed', error);

  // 2. CRM: create contact + subscription deal
  await emitCrmTask('onNewSubscription', {
    brand: event.brand,
    email: event.email,
    stripe_customer_id: event.stripe_customer_id,
    plan_id: event.plan_id,
    mrr_usd: getMrrFromPlanId(event.plan_id),
  });
}

// ---------------------------------------------------------------------------
// handlePaymentFailed
// ---------------------------------------------------------------------------
export async function handlePaymentFailed(event: PaymentFailedEvent) {
  const supabase = getSupabase();

  await supabase.from('usage_events').insert({
    event_type: 'payment_failed',
    event_ref: null,
    brand: event.brand,
  });

  console.warn('[revenue-engine] Payment failed', {
    customer: event.stripe_customer_id,
    invoice: event.invoice_id,
    amount_due: event.amount_due,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getMrrFromPlanId(plan_id: string): number {
  const map: Record<string, number> = {
    authichain_basic: 14900,
    authichain_pro: 49900,
    authichain_enterprise: 149900,
  };
  return map[plan_id] ?? 0;
}
