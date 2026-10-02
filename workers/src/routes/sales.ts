import { Hono } from 'hono';
import Stripe from 'stripe';
import Anthropic from '@anthropic-ai/sdk';

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

    const systemPrompt = `You are the elite AI Closer for AuthiChain.\nLead Name: ${name}\nIntent: ${intent}\n\nThe Stripe checkout link has been generated: ${session.url}\n\nDraft a concise, high-converting response acknowledging their specific intent and pushing them to click the checkout link to begin immediately.`;

    const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Draft the closing response.' }],
    });
    const aiResponse = msg.content[0].type === 'text' ? msg.content[0].text : 'Click the link to checkout.';

    return c.json({ success: true, lead: email, checkoutUrl: session.url, aiResponse });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
