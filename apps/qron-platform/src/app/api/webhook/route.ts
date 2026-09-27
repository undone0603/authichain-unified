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
        ...(credits >= 999999 ? { generations_limit: 999999 } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

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

async function triggerTokenomics(userId: string | null | undefined, amount: number) {
  if (!userId || amount <= 0) return;
  try {
    const { processFeeFlow } = await import('@/lib/authentic-economy');
    const supabase = await getServiceClient();
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

async function sendQrEmail(
  to: string,
  imageUrl: string,
  qrUrl: string,
  prompt: string
) {
  const result = await sendEmail({
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'QRON <hello@qron.space>',
    subject: 'Your QRON QR Code is Ready',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ededed;padding:32px;border-radius:12px;"><h1 style="color:#c9a227;">Your QRON is Ready</h1><p style="color:#9e9e9e;">Here's your AI-generated QR code:</p><div style="text-align:center;margin:24px 0;"><img src="${imageUrl}" alt="Your QRON" style="max-width:360px;width:100%;border-radius:12px;" /></div><p><strong style="color:#c9a227;">Links to:</strong> <a href="${qrUrl}" style="color:#c9a227;">${qrUrl}</a></p><p><strong style="color:#c9a227;">Style:</strong> ${prompt}</p></div>`,
    text: `Your QRON QR Code is ready!\n\nDownload: ${imageUrl}\nLinks to: ${qrUrl}\nStyle: ${prompt}`,
  });
  if (!result.ok) {
    console.warn('[email] QR delivery failed:', result.provider, result.error);
    await logAutomation('stripe_webhook.sendQrEmail', 'event', 'failure', { to, provider: result.provider }, result.error);
    return;
  }
  console.log(`[email] QR delivered to ${to} via ${result.provider}`);
}

async function generateAndDeliverQr(session: Stripe.Checkout.Session) {
  const { url, prompt } = session.metadata || {};
  const customerEmail = session.customer_email || session.customer_details?.email;
  if (!url || !prompt || !customerEmail) {
    console.warn('[webhook] Skipping QR gen — missing url/prompt/email in metadata');
    return;
  }
  try {
    const hfResult = await generateLivingQR({
      url,
      prompt: `highly detailed QR code art, scannable, ${prompt}`,
    });
    await Promise.all([
      sendQrEmail(customerEmail, hfResult.imageUrl, url, prompt),
      recordDelivery(session.id, customerEmail, hfResult.imageUrl, url, prompt),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] generateAndDeliverQr error:', err);
    await logAutomation('stripe_webhook.generateAndDeliverQr', 'event', 'failure', { sessionId: session.id, customerEmail }, msg);
  }
}

async function generateAndDeliverTargetedQron(session: Stripe.Checkout.Session) {
  const { url, subject, style = 'portrait', mintNft = 'false' } = session.metadata || {};
  const customerEmail = session.customer_email || session.customer_details?.email;
  if (!url || !subject || !customerEmail) {
    console.warn('[webhook] Skipping targeted QRON — missing url/subject/email in metadata');
    return;
  }
  const STYLE_MAP: Record<string, string> = {
    cyberpunk: 'cyberpunk aesthetic, neon lights, glitch art, futuristic cityscape',
    watercolor: 'watercolor painting, soft brush strokes, vibrant color splashes',
    miniature: 'tilt-shift photography, miniature architecture, tiny world',
    luxury: 'luxury brand aesthetic, golden embossed seal, holographic foil',
    graffiti: 'street art mural, graffiti style, spray paint texture',
    anime: 'anime art style, cel shading, vivid colors',
    portrait: 'classical oil painting portrait, dramatic chiaroscuro lighting',
    geometric: 'abstract geometric art, bold shapes, Bauhaus-inspired composition',
    nature: 'botanical illustration, lush jungle foliage, tropical flowers',
  };
  const styleDesc = STYLE_MAP[style] ?? style;
  const prompt = `${subject}, ${styleDesc}, seamlessly integrated into a scannable QR code pattern, highly detailed, photorealistic`;
  try {
    const hfResult = await generateLivingQR({ url, prompt });
    let txHash: string | undefined;
    if (mintNft === 'true' && process.env.QRON_NFT_CONTRACT_ADDRESS && process.env.THIRDWEB_MINTER_KEY) {
      try {
        const mintRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space'}/api/qron/mint-nft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: session.metadata?.walletAddress || process.env.DEMO_WALLET_ADDRESS,
            imageUrl: hfResult.imageUrl,
            destinationUrl: url,
            qronId: `custom-${session.id}`,
          }),
        });
        if (mintRes.ok) {
          const mintData = await mintRes.json();
          txHash = mintData.txHash;
        }
      } catch (mintErr) {
        console.warn('[webhook] Non-fatal NFT mint error:', mintErr);
      }
    }
    await sendQrEmail(customerEmail, hfResult.imageUrl, url, prompt);
    await recordDelivery(session.id, customerEmail, hfResult.imageUrl, url, prompt);
    if (txHash) console.log('[webhook] NFT minted', txHash);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] generateAndDeliverTargetedQron error:', err);
    await logAutomation('stripe_webhook.generateAndDeliverTargetedQron', 'event', 'failure', { sessionId: session.id, customerEmail }, msg);
  }
}

async function fulfillStoryMode(session: Stripe.Checkout.Session) {
  const { qronId, tier = 'pro' } = session.metadata || {};
  if (!qronId) {
    console.warn('[webhook] story_mode: no qronId in metadata');
    return;
  }
  const supabase = await getServiceClient();
  await supabase.from('qrons').update({
    story_enabled: true,
    story_tier: tier,
    story_unlocked_at: new Date().toISOString(),
  }).eq('id', qronId);
  const userId = session.metadata?.userId;
  if (userId) {
    await supabase.from('profiles').update({
      story_mode_enabled: true,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
  }
  const customerEmail = session.customer_email || session.customer_details?.email;
  if (customerEmail) {
    const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space'}/dashboard`;
    const result = await sendEmail({
      to: customerEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'QRON <hello@qron.space>',
      subject: 'AI Story Mode Unlocked',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ededed;padding:40px 32px;"><h1 style="color:#c9a227;">AI Story Mode Unlocked</h1><p>Your QRON now has Story Mode (${tier}) activated.</p><p><a href="${dashUrl}">Open Dashboard</a></p></div>`,
      text: `AI Story Mode (${tier}) unlocked! Manage your QRON at ${dashUrl}`,
    });
    if (!result.ok) {
      await logAutomation('stripe_webhook.fulfillStoryMode.email', 'event', 'failure', { to: customerEmail, qronId, tier }, result.error);
    }
  }
  console.log(`[webhook] Story Mode (${tier}) unlocked for QRON ${qronId}`);
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    await logAutomation('stripe_webhook', 'event', 'failure', null, 'Stripe env not configured');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    await logAutomation('stripe_webhook', 'event', 'failure', null, 'missing stripe-signature header');
    return NextResponse.json({ error: 'No stripe-signature header' }, { status: 400 });
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-08-26.dahlia' as const });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Signature verification failed:', err);
    await logAutomation('stripe_webhook', 'event', 'failure', null, `signature verification failed: ${msg}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[webhook] ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { planId, userId } = session.metadata || {};
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        await saveCustomerId(userId, customerId);
        await fulfillPlan(userId, planId);
        await triggerTokenomics(userId, session.amount_total ? session.amount_total / 100 : 0);
        if (session.mode === 'payment') {
          const purchaseType = session.metadata?.type;
          if (purchaseType === 'custom_qron') await generateAndDeliverTargetedQron(session);
          else if (purchaseType === 'story_mode') await fulfillStoryMode(session);
          else await generateAndDeliverQr(session);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.status === 'active') await fulfillPlan(sub.metadata?.userId, sub.metadata?.planId);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : null;
        if (customerId) await downgradeUser(customerId);
        break;
      }
      default:
        break;
    }
    await logAutomation('stripe_webhook', 'event', 'success', { event_type: event.type, event_id: event.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Handler error for ${event.type}:`, err);
    await logAutomation('stripe_webhook', 'event', 'failure', { event_type: event.type, event_id: event.id }, msg);
  }

  return NextResponse.json({ received: true });
}
