import Stripe from 'stripe';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('ok', { status: 200 });

    const sig = request.headers.get('stripe-signature');
    const body = await request.text();
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      return new Response('missing signature', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return new Response(`webhook error: ${(err as Error).message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      const amount = session.amount_total;
      const customerId = session.customer as string | null;

      if (!email) return new Response('no email', { status: 400 });

      if (amount === 2900) {
        await env.DB.prepare(`
          INSERT INTO tenants (email, stripe_customer_id, pack_credits, plan)
          VALUES (?, ?, 100, 'starter')
          ON CONFLICT(email) DO UPDATE SET
            pack_credits = pack_credits + 100,
            stripe_customer_id = COALESCE(stripe_customer_id, excluded.stripe_customer_id)
        `).bind(email, customerId).run();
      }

      if (amount === 1900 && session.mode === 'subscription') {
        await env.DB.prepare(`
          INSERT INTO tenants (email, stripe_customer_id, plan)
          VALUES (?, ?, 'launch')
          ON CONFLICT(email) DO UPDATE SET
            plan = 'launch',
            stripe_customer_id = COALESCE(stripe_customer_id, excluded.stripe_customer_id)
        `).bind(email, customerId).run();
      }

      await env.DB.prepare(`
        INSERT INTO webhook_log (event_type, email, amount, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(event.type, email, amount).run();
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const email = invoice.customer_email;
      if (email && invoice.amount_paid === 1900) {
        await env.DB.prepare(`
          UPDATE tenants SET plan = 'launch' WHERE email = ?
        `).bind(email).run();
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
};
