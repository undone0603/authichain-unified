<<<<<<< HEAD
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createClient<any>> | null = null;
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

interface WebhookSubscription {
  url: string;
  secret?: string | null;
}

function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Fire-and-forget webhook dispatch. Looks up subscriptions for the user/event
 * in `webhook_subscriptions` and POSTs the payload to each registered URL.
 * Failures are logged but never thrown — callers are autonomous loops.
 */
export async function dispatchWebhook(
  userId: string | null,
  event: string,
  payload: unknown,
): Promise<void> {
  const client = getClient();
  if (!client || !userId) return;

  let subs: WebhookSubscription[] = [];
  try {
    const { data, error } = await client
      .from('webhook_subscriptions')
      .select('url, secret')
      .eq('user_id', userId)
      .eq('event_type', event)
      .eq('is_active', true);
    if (error) {
      console.warn('[webhooks] subscription lookup failed:', error.message);
      return;
    }
    subs = (data ?? []) as WebhookSubscription[];
  } catch (err) {
    console.warn('[webhooks] subscription lookup threw:', err);
    return;
  }

  if (subs.length === 0) return;

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sub.secret) {
          headers['X-AuthiChain-Signature'] = signPayload(sub.secret, body);
        }
        await fetch(sub.url, { method: 'POST', headers, body });
      } catch (err) {
        console.warn(`[webhooks] dispatch to ${sub.url} failed:`, err);
      }
    }),
  );
=======
/**
 * @file webhooks.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'not_configured'
);

export type WebhookEvent = 'qron_scanned' | 'security_anomaly' | 'certification_approved';

/**
 * Dispatches a protocol event to all active subscribers for a user's brand.
 */
export async function dispatchWebhook(userId: string, eventType: WebhookEvent, payload: unknown) {
  try {
    // 1. Fetch brand for this user
    const { data: brand } = await admin
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!brand) return;

    // 2. Fetch active subscriptions for this brand
    const { data: subs } = await admin
      .from('brand_webhooks')
      .select('*')
      .eq('brand_id', brand.id)
      .eq('is_active', true);

    if (!subs || subs.length === 0) return;

    // 3. Filter by event type
    const relevantSubs = subs.filter(s => (s.events as string[]).includes(eventType));

    // 4. Dispatch (Asynchronous)
    relevantSubs.forEach(async (sub) => {
      try {
        const body = JSON.stringify({
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          event: eventType,
          created_at: new Date().toISOString(),
          data: payload
        });

        // Production-grade HMAC-SHA256 signature
        const timestamp = Date.now().toString();
        const signaturePayload = `${timestamp}.${body}`;
        const signature = crypto
          .createHmac('sha256', sub.secret_key)
          .update(signaturePayload)
          .digest('hex');

        await fetch(sub.endpoint_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AuthiChain-Signature': signature,
            'X-AuthiChain-Timestamp': timestamp,
            'User-Agent': 'AuthiChain-Hookshot/1.4'
          },
          body
        });
      } catch (err) {
        console.error(`[webhooks] Dispatch failed to ${sub.endpoint_url}:`, err);
      }
    });
  } catch (err) {
    console.error('[webhooks] Dispatch Error:', err);
  }
>>>>>>> origin/add-agentz-editable
}
