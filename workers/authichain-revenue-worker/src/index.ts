interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ENTERPRISE: string;
  STRIPE_PRICE_BASIC: string;
  NEXT_PUBLIC_APP_URL: string;
  ANTHROPIC_API_KEY: string;
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // 1. x402 MACHINE-TO-MACHINE MONETIZATION
    // Intercepts unauthenticated API requests and returns a Stripe payment link
    if (url.pathname.startsWith('/api/verify') || url.pathname.startsWith('/api/scan')) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        const paymentUrl = 'https://authichain.com/checkout/starter';
        return new Response(JSON.stringify({
          error: "Payment Required",
          message: "This endpoint requires an active AuthiChain subscription.",
          payment_url: paymentUrl
        }), {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Required': paymentUrl
          }
        });
      }
    }

    // Include any of your existing fetch routing here
    return new Response("AuthiChain Edge Active", { status: 200 });
  },

  // 2. AUTONOMOUS OUTBOUND LOOP
  // Fires via the 0 * * * * Cron Trigger you configured earlier
  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext) {
    // No verified lead is named. Do not call Anthropic or create a Checkout session.
    console.log("Outbound loop skipped: no verified recipient");
  }
};
