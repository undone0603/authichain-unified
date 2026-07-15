/**
 * @file webhooks.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

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
}
