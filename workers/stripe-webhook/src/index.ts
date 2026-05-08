import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Supabase REST helper — uses fetch directly (CF Worker compatible)
async function supabaseUpsert(
  env: Env,
  table: string,
  data: Record<string, unknown>,
  onConflict?: string
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${
    onConflict ? `?on_conflict=${onConflict}` : ''
  }`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });
}

async function supabaseUpdate(
  env: Env,
  table: string,
  match: Record<string, string>,
  data: Record<string, unknown>
): Promise<void> {
  const params = Object.entries(match)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join('&');
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${params}`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(data),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('Missing signature', { status: 400 });

    let event: Stripe.Event;
    try {
      const body = await request.text();
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new Response(`Error: ${msg}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      const name = session.customer_details?.name || 'QRON User';
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

      if (email) {
        // Upsert profile
        await supabaseUpsert(env, 'profiles', {
          email,
          full_name: name,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan: session.metadata?.plan || 'starter',
          updated_at: new Date().toISOString(),
        }, 'email');
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : null;
      if (customerId) {
        await supabaseUpdate(env, 'profiles', { stripe_customer_id: customerId }, {
          stripe_subscription_status: sub.status,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      if (customerId) {
        await supabaseUpdate(env, 'profiles', { stripe_customer_id: customerId }, {
          stripe_subscription_status: 'past_due',
          updated_at: new Date().toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
