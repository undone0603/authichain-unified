export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Edge-compatible HMAC-SHA256 signature verification for Stripe Webhooks
async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const enc = new TextEncoder();
  const sigParts = signatureHeader.split(',');
  let t = '';
  let v1 = '';
  
  for (const part of sigParts) {
    const [key, value] = part.split('=');
    if (key === 't') t = value;
    if (key === 'v1') v1 = value;
  }
  
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = new Uint8Array(v1.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  return await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    enc.encode(signedPayload)
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/api/webhooks/stripe") {
      return new Response("Not found or method not allowed", { status: 404 });
    }

    try {
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return new Response("Missing signature", { status: 400 });
      }

      const payload = await request.text();
      const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);

      if (!isValid) {
        return new Response("Invalid signature", { status: 400 });
      }

      const event = JSON.parse(payload);

      // 1. Process Stripe Events to manage AuthiChain organization subscriptions
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          
          // Log to Supabase and update organization plan
          await fetch(`${env.SUPABASE_URL}/rest/v1/organizations?stripe_customer_id=eq.${session.customer}`, {
            method: 'PATCH',
            headers: {
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: 'Active' }) 
          });
          break;
        }
        case 'customer.subscription.deleted': {
          // Handle churn / downgrades
          break;
        }
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return new Response(JSON.stringify({ received: true }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      });

    } catch (err: any) {
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  }
};
