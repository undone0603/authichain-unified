import { Anthropic } from '@anthropic-ai/sdk';
import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ENTERPRISE: string;
  STRIPE_PRICE_BASIC: string;
  NEXT_PUBLIC_APP_URL: string;
  ANTHROPIC_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // 1. x402 MACHINE-TO-MACHINE MONETIZATION
    // Intercepts unauthenticated API requests and returns a Stripe payment link
    if (url.pathname.startsWith('/api/verify') || url.pathname.startsWith('/api/scan')) {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader) {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        
        const session = await stripe.checkout.sessions.create({
          line_items: [{ price: env.STRIPE_PRICE_ENTERPRISE, quantity: 1 }],
          mode: 'subscription',
          success_url: `${env.NEXT_PUBLIC_APP_URL}/docs/api-keys`,
        });

        if (!session.url) {
          return new Response(JSON.stringify({
            error: "Payment Required",
            message: "This endpoint requires an active AuthiChain subscription.",
          }), {
            status: 402,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          error: "Payment Required",
          message: "This endpoint requires an active AuthiChain subscription.",
          payment_url: session.url
        }), {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Required': session.url
          }
        });
      }
    }

    // Include any of your existing fetch routing here
    return new Response("AuthiChain Edge Active", { status: 200 });
  },

  // 2. AUTONOMOUS OUTBOUND LOOP
  // Fires via the 0 * * * * Cron Trigger you configured earlier
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const targetLead = { email: "founder@target-brand.com", company: "Target Brand" };

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 500,
      system: "You are the AuthiChain compliance engine. Generate a JSON payload for an EU Digital Product Passport.",
      messages: [{ role: "user", content: `Generate a compliant passport payload for a flagship product from ${targetLead.company}.` }]
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: env.STRIPE_PRICE_BASIC, quantity: 1 }],
      mode: 'subscription',
      success_url: `${env.NEXT_PUBLIC_APP_URL}/onboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
      customer_email: targetLead.email,
    });

    console.log(`Outbound Loop Executed: Target ${targetLead.email} | Checkout URL: ${session.url}`);
  }
};
