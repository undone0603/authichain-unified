export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * GET /api/v1/api-keys
 *
 * List all API keys for the authenticated user (requires Authorization header with session token).
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: keys, error: keysErr } = await supabase
      .from('api_keys')
      .select('id, name, created_at, last_used_at, masked_key')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (keysErr) {
      return NextResponse.json({ error: keysErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      keys: keys || [],
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/api-keys
 *
 * Create a new API key for the authenticated user and set up their metered subscription
 * in Stripe (if not already subscribed to a metered product).
 *
 * Body: { name: string }
 * Returns: { success: true, key: string, name: string, created_at: string }
 *
 * The key is returned only once — store it securely. Subsequent GETs will not reveal it.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { name?: string };
    const keyName = typeof body.name === 'string' ? body.name.trim() : `Key ${Date.now()}`;

    if (!keyName) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 });
    }

    // Generate a cryptographically secure API key (prefix: qron_live_)
    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKey = `qron_live_${rawKey}`;
    const keyPrefix = apiKey.substring(0, 16); // qron_live_ = 10 chars + 6 more

    // Hash the full key using Web Crypto API
    const msgUint8 = new TextEncoder().encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const maskedKey = `qron_live_${rawKey.slice(0, 8)}...${rawKey.slice(-8)}`;

    // 1. Create the API key record
    const { data: keyRecord, error: keyErr } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: keyName,
        key_prefix: keyPrefix,
        key_hash: hashedKey,
        masked_key: maskedKey,
        is_active: true,
      })
      .select('id, name, created_at')
      .single();

    if (keyErr) {
      return NextResponse.json({ error: keyErr.message }, { status: 500 });
    }

    // 2. Check if user has a Stripe customer + metered subscription
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    const profile = profileRow as
      | { stripe_customer_id: string | null; stripe_subscription_id: string | null }
      | null;

    // 3. If no customer, create one in Stripe
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-05-27.dahlia' as const,
      });

      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, authichain_tier: 'verify_api_metered' },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    // 4. If no subscription to metered product, create one
    // (This assumes the metered product and price are pre-created in Stripe)
    if (!profile?.stripe_subscription_id) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-05-27.dahlia' as const,
      });

      // Price ID for verify API metered (created in Stripe dashboard or via Terraform)
      const meteredPriceId = process.env.STRIPE_VERIFY_METERED_PRICE_ID;
      if (!meteredPriceId) {
        console.warn('[api-keys] STRIPE_VERIFY_METERED_PRICE_ID not configured — skipping subscription');
      } else {
        try {
          const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: meteredPriceId }],
            metadata: {
              user_id: user.id,
              authichain_tier: 'verify_api_metered',
            },
          });

          await supabase
            .from('profiles')
            .update({ stripe_subscription_id: subscription.id })
            .eq('user_id', user.id);

          console.log(
            `[api-keys] Created metered subscription ${subscription.id} for customer ${customerId}`
          );
        } catch (subErr) {
          console.error('[api-keys] Failed to create metered subscription:', subErr);
          // Non-blocking — key was created; subscription can be set up manually
        }
      }
    }

    return NextResponse.json({
      success: true,
      key: apiKey, // Only revealed once
      name: keyRecord.name,
      created_at: keyRecord.created_at,
      note: 'Store this key securely. It will not be shown again.',
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/api-keys?key_id=<uuid>
 *
 * Revoke an API key. Requires user authentication via Bearer token.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('key_id');

    if (!keyId) {
      return NextResponse.json({ error: 'key_id is required' }, { status: 400 });
    }

    // Verify ownership before deletion
    const { data: keyRecord, error: keyErr } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', user.id)
      .single();

    if (keyErr || !keyRecord) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    const { error: delErr } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'API key revoked' });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
