import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const DISPATCH_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

let _client: ReturnType<typeof createClient> | null = null;
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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function dispatchWithRetry(sub: WebhookSubscription, body: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub.secret) {
    headers['X-AuthiChain-Signature'] = signPayload(sub.secret, body);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      });
      // Consider 2xx a success; retry on 5xx
      if (res.ok || res.status < 500) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn(`[webhooks] dispatch to ${sub.url} failed after ${MAX_RETRIES + 1} attempts:`, lastErr);
}

/**
 * Fire-and-forget webhook dispatch.
 * Looks up subscriptions for the user/event in `webhook_subscriptions`
 * and POSTs the signed payload to each registered URL with retries.
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
      .e