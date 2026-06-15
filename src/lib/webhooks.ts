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
}
