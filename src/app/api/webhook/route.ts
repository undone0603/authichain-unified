import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { PLAN_CREDITS, PLAN_TIER, type PlanId } from '@/lib/plans';

const CF_WORKER_URL =
  process.env.QRON_WORKER_URL ||
  'https://qron-ai-api.undone-k.workers.dev';

export const runtime = 'nodejs';

// â”€â”€â”€ Supabase helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getServiceClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// â”€â”€â”€ Grant credits + upgrade tier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    console.error('[webhook] fulfillPlan error (non-fatal):', err);
  }
}

// â”€â”€â”€ Trigger Tokenomics Cycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    console.error('[webhook] tokenomics trigger error:', err);
  }
}

// â”€â”€â”€ Downgrade on subscription cancel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    console.error('[webhook] downgradeUser error (non-fatal):', err);
  }
}

// â”€â”€â”€ Save Stripe customer ID to profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    console.error('[webhook] saveCustomerId error (non-fatal):', err);
  }
}

// â”€â”€â”€ Record delivery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    console.error('[webhook] recordDelivery error (non-fatal):', err);
  }
}

// â”€â”€â”€ Email QR to customer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sendQrEmail(
  to: string,
  imageUrl: string,
  qrUrl: string,
  prompt: string
) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set â€” skipping');
    return;
  }
  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(apiKey);
  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'hello@qron.space',
    subject: 'Your QRON QR Code is Ready ðŸŽ¨',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ededed;padding:32px;border-radius:12px;">
        <h1 style="color:#c9a227;margin-bottom:8px;">Your QRON is Ready</h1>
        <p style="color:#9e9e9e;">Here's your AI-generated QR code:</p>
        <div style="text-align:center;margin:24px 0;">
          <img src="${imageUrl}" alt="Your QRON" style="max-width:360px;width:100%;border-radius:12px;border:1px solid rgba(201,162,39,0.3);" />
        </div>
        <p><strong style="color:#c9a227;">Links to:</strong> <a href="${qrUrl}" style="color:#c9a227;">${qrUrl}</a></p>
        <p><strong style="color:#c9a227;">Style:</strong> <span style="color:#9e9e9e;">${prompt}</span></p>     
        <div style="margin:24px 0;">
          <a href="${imageUrl}" style="background:linear-gradient(135deg,#c9a227,#a07c10);color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">
            Download QR Code
          </a>
        </div>
        <hr style="border:none;border-top:1px solid rgba(201,162,39,0.2);margin:24px 0;" />
        <p style="color:#3a3a3a;font-size:12px;">
          Powered by <a href="https://qron.space" style="color:#c9a227;text-decoration:none;">QRON</a> Â·       
          Authenticated by <a href="https://authichain.com" style="color:#c9a227;text-decoration:none;">AuthiChain</a>
        </p>
      </div>`,
    text: `Your QRON QR Code is ready!\n\nDownload: ${imageUrl}\nLinks to: ${qrUrl}\nStyle: ${prompt}`,
  });
  console.log('[email] QR delivered to', to);
}

// â”€â”€â”€ QR generation for one-time pack purchases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function generateAndDeliverQr(session: Stripe.Checkout.Session) {
  const { url, prompt } = session.metadata || {};
  const customerEmail =
    session.customer_email || session.customer_details?.email;

  if (!url || !prompt || !customerEmail) {
    console.warn(
      '[webhook] Skipping QR gen â€” missing url/prompt/email in metadata'
    );
    return;
  }
  if (!process.env.FAL_KEY) {
    console.warn('[webhook] FAL_KEY not set â€” skipping QR generation');
    return;
  }

  const QRCode = (await import('qrcode')).default;
  const _qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    width: 1024,
    margin: 2,
  });

  const workerRes1 = await fetch(`${CF_WORKER_URL}/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      prompt: `highly detailed QR code art, scannable, ${prompt}`,
      style: 'space',
    }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!workerRes1.ok) throw new Error(`Worker error: ${workerRes1.status}`);
  const workerData1 = (await workerRes1.json()) as {
    previewUrl?: string;
    downloadUrl?: string;
  };
  const imageUrl: string | undefined =
    workerData1.downloadUrl || workerData1.previewUrl || undefined;
  if (!imageUrl) throw new Error('Fal.ai returned no image URL');

  await Promise.all([
    sendQrEmail(customerEmail, imageUrl, url, prompt),
    recordDelivery(session.id, customerEmail, imageUrl, url, prompt),
  ]);
}

// â”€â”€â”€ Targeted QRON generation for custom_qron purchases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function generateAndDeliverTargetedQron(session: Stripe.Checkout.Session) {
  const {
    url,
    subject,
    style = 'portrait',
    _steps = '50',
    _referenceImageUrl,
    mintNft = 'false',
  } = session.metadata || {};
  const customerEmail =
    session.customer_email || session.customer_details?.email;

  if (!url || !subject || !customerEmail) {
    console.warn(
      '[webhook] Skipping targeted QRON â€” missing url/subject/email in metadata'
    );
    return;
  }
  if (!process.env.FAL_KEY) {
    console.warn(
      '[webhook] FAL_KEY not set â€” skipping targeted QRON generation'
    );
    return;
  }

  // Build the same rich prompt as the targeted generator
  const isPreset = [
    'cyberpunk',
    'watercolor',
    'miniature',
    'luxury',
    'graffiti',
    'anime',
    'portrait',
    'geometric',
    'nature',
  ].includes(style);

  const STYLE_MAP: Record<string, string> = {
    cyberpunk:
      'cyberpunk aesthetic, neon lights, glitch art, futuristic cityscape, electric blue and magenta hues',
    watercolor:
      'watercolor painting, soft brush strokes, vibrant color splashes, artistic portrait, pastel tones with bold accents',
    miniature:
      'tilt-shift photography, miniature architecture, tiny world, isometric city, vivid saturation, bokeh depth-of-field',
    luxury:
      'luxury brand aesthetic, golden embossed seal, holographic foil, premium product photography, deep blacks and gold',
    graffiti:
      'street art mural, graffiti style, spray paint texture, bold outlines, urban wall art, vibrant colors',
    anime:
      'anime art style, cel shading, vivid colors, manga panel composition, expressive character design',
    portrait:
      'classical oil painting portrait, rich textures, dramatic chiaroscuro lighting, detailed brushwork',
    geometric:
      'abstract geometric art, bold shapes, primary color palette, Bauhaus-inspired composition',
    nature:
      'botanical illustration, lush jungle foliage, tropical flowers, vibrant greens and warm sunlight',
  };

  const styleDesc = isPreset ? STYLE_MAP[style] ?? STYLE_MAP.portrait : style;

  const prompt = [
    `${subject},`,
    `${styleDesc},`,
    'seamlessly integrated into a scannable QR code pattern,',
    'the QR modules form the structure of the artwork,',
    'highly detailed, photorealistic, award-winning digital art',
  ].join(' ');

  const QRCode = (await import('qrcode')).default;
  const _qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    width: 1024,
    margin: 2,
  });

  const workerRes2 = await fetch(`${CF_WORKER_URL}/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, prompt, style: 'space' }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!workerRes2.ok) throw new Error(`Worker error: ${workerRes2.status}`);
  const workerData2 = (await workerRes2.json()) as {
    previewUrl?: string;
    downloadUrl?: string;
  };
  const imageUrl: string | undefined =
    workerData2.downloadUrl || workerData2.previewUrl || undefined;
  if (!imageUrl) throw new Error('Fal.ai returned no image URL');

  // Optional NFT mint for Elite tier
  let txHash: string | undefined;
  if (
    mintNft === 'true' &&
    process.env.QRON_NFT_CONTRACT_ADDRESS &&
    process.env.THIRDWEB_MINTER_KEY
  ) {
    try {
      const mintRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space'}/api/qron/mint-nft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient:
              session.metadata?.walletAddress || process.env.DEMO_WALLET_ADDRESS,
            imageUrl,
            destinationUrl: url,
            qronId: `custom-${session.id}`,
          }),
        }
      );
      if (mintRes.ok) {
        const mintData = await mintRes.json();
        txHash = mintData.txHash;
      }
    } catch (mintErr) {
      console.warn('[webhook] Non-fatal NFT mint error:', mintErr);
    }
  }

  // Send enhanced email for targeted QRON
  await sendTargetedQronEmail(
    customerEmail,
    imageUrl,
    url,
    subject,
    style,
    txHash
  );
  await recordDelivery(session.id, customerEmail, imageUrl, url, prompt);
}

// â”€â”€â”€ Enhanced email for targeted QRON delivery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sendTargetedQronEmail(
  to: string,
  imageUrl: string,
  qrUrl: string,
  subject: string,
  style: string,
  txHash?: string
) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set â€” skipping');
    return;
  }

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(apiKey);

  const nftSection = txHash
    ? `<p><strong style="color:#c9a227;">NFT Minted:</strong> <a href="https://basescan.org/tx/${txHash}" style="color:#c9a227;">${txHash.slice(0, 20)}...</a></p>`
    : '';

  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'hello@qron.space',
    subject: `Your Custom QRON is Ready â€” ${subject.slice(0, 40)} ðŸŽ¨`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ededed;padding:40px 32px;border-radius:16px;border:1px solid rgba(201,162,39,0.2);">
        <div style="text-align:center;margin-bottom:28px;">
          <span style="color:#c9a227;font-size:32px;font-weight:900;letter-spacing:-1px;">QRON</span>
          <p style="color:#6b6b6b;font-size:12px;margin:4px 0 0;">by AuthiChain Protocol</p>
        </div>

        <h1 style="color:#ffffff;font-size:26px;margin-bottom:6px;">Your Custom QRON is Ready</h1>
        <p style="color:#9e9e9e;margin-bottom:24px;">Your personalized AI QR code has been generated and authenticated.</p>

        <div style="text-align:center;background:#111;padding:24px;border-radius:12px;border:1px solid rgba(201,162,39,0.15);margin-bottom:24px;">
          <img src="${imageUrl}" alt="Your Custom QRON" style="max-width:360px;width:100%;border-radius:10px;" />
        </div>

        <div style="background:rgba(201,162,39,0.05);border:1px solid rgba(201,162,39,0.15);border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;"><strong style="color:#c9a227;">Subject:</strong> <span style="color:#c8c8c8;">${subject}</span></p>
          <p style="margin:0 0 8px;"><strong style="color:#c9a227;">Style:</strong> <span style="color:#c8c8c8;">${style}</span></p>
          <p style="margin:0;"><strong style="color:#c9a227;">Links to:</strong> <a href="${qrUrl}" style="color:#c9a227;">${qrUrl}</a></p>
          ${nftSection}
        </div>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="${imageUrl}" download style="background:linear-gradient(135deg,#c9a227,#a07c10);color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;display:inline-block;">  
            â¬‡ Download Your QRON
          </a>
        </div>

        <p style="color:#6b6b6b;font-size:12px;margin-bottom:12px;">
          Want another? Use code <strong style="color:#c9a227;">RETURN10</strong> for 10% off your next custom QRON.
        </p>

        <hr style="border:none;border-top:1px solid rgba(201,162,39,0.15);margin:24px 0;" />
        <p style="color:#3a3a3a;font-size:11px;text-align:center;">
          <a href="https://qron.space" style="color:#c9a227;text-decoration:none;">qron.space</a> Â·
          <a href="https://authichain.com" style="color:#c9a227;text-decoration:none;">authichain.com</a>       
        </p>
      </div>`,
    text: `Your Custom QRON is ready!\n\nSubject: ${subject}\nStyle: ${style}\nLinks to: ${qrUrl}\n\nDownload: ${imageUrl}${txHash ? `\nNFT: https://basescan.org/tx/${txHash}` : ''}\n\nWant another? Use RETURN10 for 10% off.`,
  });
  console.log('[email] Custom targeted QRON delivered to', to);
}

// â”€â”€â”€ Story Mode fulfillment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fulfillStoryMode(session: Stripe.Checkout.Session) {
  const { qronId, tier = 'pro' } = session.metadata || {};
  if (!qronId) {
    console.warn('[webhook] story_mode: no qronId in metadata');
    return;
  }

  const supabase = await getServiceClient();

  // Unlock story mode on the QRON (Permanent table)
  const isNumeric = /^\d+$/.test(qronId);
  const { error: _qronError } = await supabase
    .from('qrons')
    .update({
      story_enabled: true,
      story_tier: tier,
      story_unlocked_at: new Date().toISOString(),
    })
    .eq(isNumeric ? 'id' : 'id', qronId); // Assuming id is what we get

  // Also grant story_mode_enabled on user profile
  const userId = session.metadata?.userId;
  if (userId) {
    await supabase
      .from('profiles')
      .update({
        story_mode_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  // Backup: Also try updating qron_generations if qronId is a UUID
  if (!isNumeric) {
    await supabase
      .from('qron_generations')
      .update({
        // story_enabled: true, // We don't have this column here yet, but qrons has it
      })
      .eq('id', qronId);
  }

  // Notify customer
  const customerEmail =
    session.customer_email || session.customer_details?.email;
  if (customerEmail) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      const sgMail = (await import('@sendgrid/mail')).default;
      sgMail.setApiKey(apiKey);
      const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space'}/dashboard`;
      await sgMail
        .send({
          to: customerEmail,
          from: process.env.SENDGRID_FROM_EMAIL || 'hello@qron.space',
          subject: 'AI Story Mode Unlocked ðŸŽ¬',
          html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ededed;padding:40px 32px;border-radius:16px;border:1px solid rgba(201,162,39,0.2);">
            <h1 style="color:#c9a227;">AI Story Mode Unlocked</h1>
            <p style="color:#9e9e9e;">Your QRON now has Story Mode (<strong style="color:#c8c8c8;">${tier}</strong> tier) activated.</p>
            <p style="color:#9e9e9e;">Go to your dashboard to:</p>
            <ul style="color:#9e9e9e;">
              <li>Update the destination URL anytime</li>
              <li>Write your brand story and narrative</li>
              <li>Add animated scenes and CTAs</li>
              ${tier === 'elite' ? '<li>Embed video and track analytics</li>' : ''}
            </ul>
            <div style="margin:28px 0;">
              <a href="${dashUrl}" style="background:linear-gradient(135deg,#c9a227,#a07c10);color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;">
                Open Dashboard â†’
              </a>
            </div>
            <hr style="border:none;border-top:1px solid rgba(201,162,39,0.15);margin:24px 0;" />
            <p style="color:#3a3a3a;font-size:11px;text-align:center;">QRON Â· AuthiChain Protocol</p>
          </div>`,
          text: `AI Story Mode (${tier}) unlocked! Manage your QRON at ${dashUrl}`,
        })
        .catch((e) => console.warn('[webhook] story mode email error:', e));
    }
  }

  console.log(`[webhook] Story Mode (${tier}) unlocked for QRON ${qronId}`);
}

// â”€â”€â”€ Webhook handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'No stripe-signature header' },
      { status: 400 }
    );
  }

  const Stripe = (await import('stripe')).default;
  // @ts-expect-error - version mismatch
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[webhook] ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { planId, userId } = session.metadata || {};
        const customerId =
          typeof session.customer === 'string' ? session.customer : null;

        // Persist Stripe customer ID
        await saveCustomerId(userId, customerId);

        // Grant credits / upgrade tier
        await fulfillPlan(userId, planId);

        // Trigger Tokenomics (Fee split + Burn)
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        await triggerTokenomics(userId, amount);

        // Route to the correct handler based on purchase type
        if (session.mode === 'payment') {
          const purchaseType = session.metadata?.type;
          if (purchaseType === 'custom_qron') {
            await generateAndDeliverTargetedQron(session);
          } else if (purchaseType === 'story_mode') {
            await fulfillStoryMode(session);
          } else {
            await generateAndDeliverQr(session);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        // Re-fulfill if subscription reactivated
        if (sub.status === 'active') {
          const userId = sub.metadata?.userId;
          const planId = sub.metadata?.planId;
          await fulfillPlan(userId, planId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : null;
        if (customerId) await downgradeUser(customerId);
        break;
      }

      default:
        // Unhandled event types â€” ignore silently
        break;
    }
  } catch (err) {
    console.error(`[webhook] Handler error for ${event.type}:`, err);
    // Return 200 so Stripe doesn't retry; errors are logged
  }

  return NextResponse.json({ received: true });
}
