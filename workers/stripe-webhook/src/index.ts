import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
    const signature = request.headers.get('stripe-signature');
    if (!signature) return new Response('Missing signature', { status: 400 });
    
    let event;
    try {
      const body = await request.text();
      event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      const name = session.customer_details?.name || 'Local Pilot';
      if (!email) return new Response('No email', { status: 400 });

      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: tenant } = await supabase.from('tenants').insert([{ name, email, subscription_status: 'active', plan: 'beta_pilot' }]).select().single();
      if (!tenant) return new Response('DB error', { status: 500 });

      const rawKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      await supabase.from('api_keys').insert([{ tenant_id: tenant.id, key: `sk_live_${rawKey}`, type: 'production' }]);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
};
