import { Hono } from 'hono';
import Stripe from 'stripe';

type Bindings = {
  STRIPE_SECRET_KEY: string;
  ANTHROPIC_API_KEY: string;
  SUCCESS_URL: string;
  CANCEL_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/api/sales/inbound', async (c) => {
  try {
    const { name, email, intent, budget } = await c.req.json();
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'AuthiChain Integration', description: intent },
          unit_amount: budget * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: c.env.SUCCESS_URL,
      cancel_url: c.env.CANCEL_URL,
    });

    const systemPrompt = `Lead Name: ${name}. Intent: ${intent}. Link: ${session.url}`;

    return c.json({ success: true, lead: email, checkoutUrl: session.url });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
