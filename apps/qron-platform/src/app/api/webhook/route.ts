import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { PLAN_CREDITS, PLAN_TIER, type PlanId } from '@/lib/plans';
import { generateLivingQR } from '@/lib/hf-generation';
import { logAutomation } from '@/lib/automation';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

// --- Supabase helper ---

async function getServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// --- Grant credits + upgrade tier ---

async function fulfillPlan(
  userId: string | null | undefined,
  planId: string | null | undefined
) {
  if (!userId || !planId) return;
  const id = planId as PlanId;
  const credits = PLAN_CREDITS[id];
  const tier = PLAN_TIER[id];
  if (!credits && !tier) return;

  try {
    const supabase = await getServiceClient();
    await supabase
      .from('profiles')
      .update({
        tier,
        // Incremental credits are added via rpc below; only set limit for unlimited tier
        ...(credits >= 999999 ? { generations_limit: 999999 } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Add credits incrementally (so existing balance isn't wiped)
    if (credits > 0 && credits < 999999) {
      await supabase.rpc('add_generation_credits', {
        user_uuid: userId,
        amount: credits,
      });
    } else if (credits >= 999999) {
      await supabase
        .from('profiles')
        .update({ generations_limit: 999999, tier })
        .eq('user_id', userId);
    }

    console.log(
      `[webhook] Fulfilled plan="${id}" for user=${userId} credits=${credits} tier=${tier}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] fulfillPlan error (non-fatal):', err);
    await logAutomation('stripe_webhook.fulfillPlan', 'event', 'failure', { userId, planId }, msg);
  }
}

// ─── Trigger Tokenomics Cycle ──────────────────────────

async function triggerTokenomics(userId: string | null | undefined, amount: number) {
  if (!userId || amount <= 0) return;
  try {
    const { processFeeFlow } = await import('@/lib/authentic-economy');
    const supabase = await getServiceClient();
    
    // Find brand associated with user
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (brand) {
      await processFeeFlow({
        brandId: brand.id,
        userId: userId,
        flowType: 'authentication_fee',
        metadata: { source: 'stripe_payment', fiat_amount: amount }
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] tokenomics trigger error:', err);
    await logAutomation('stripe_webhook.triggerTokenomics', 'event', 'failure', { userId, amount }, msg);
  }
}

// ─── Downgrade on subscription cancel ────────────────────────

async function downgradeUser(stripeCustomerId: string) {
  try {
    const supabase = await getServiceClient();
    await supabase
      .from('profiles')
      .update({
        tier: 'free',
        generations_limit: 10,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', stripeCustomerId);
    console.log('[webhook] Downgraded customer', stripeCustomerId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] downgradeUser error (non-fatal):', err);
    await logAutomation('stripe_webhook.downgradeUser', 'event', 'failure', { stripeCustomerId }, msg);
  }
}

// ─── Save Stripe customer ID to profile ──────────────────────

async function saveCustomerId(
  userId: string | null | undefined,
  customerId: string | null
) {
  if (!userId || !customerId) return;
  try {
    const supabase = await getServiceClient();
    await supabase
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] saveCustomerId error (non-fatal):', err);
    await logAutomation('stripe_webhook.saveCustomerId', 'event', 'failure', { userId, customerId }, msg);
  }
}

// ─── Record delivery ───────────────────────────────────

async function recordDelivery(
  sessionId: string,
  email: string,
  imageUrl: string,
  qrUrl: string,
  prompt: string
) {
  try {
    const supabase = await getServiceClient();
    await supabase.from('qron_deliveries').upsert(
      {
        stripe_session_id: sessionId,
        customer_email: email,
        image_url: imageUrl,
        qr_url: qrUrl,
        prompt,
        delivered_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_session_id' }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] recordDelivery error (non-fatal):', err);
    await logAutomation('stripe_webhook.recordDelivery', 'event', 'failure', { sessionId, email }, msg);
  }
}
