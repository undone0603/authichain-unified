--9f436704b5ff716cd8fe624e75b39d895d6faa3ae354a5a7d91995f682b7
Content-Disposition: form-data; name="worker.js"

/**
 * Stripe Listener Worker — Cloudflare-Compatible Version
 * No imports, no bundling required.
 * Uses Web Crypto for signature verification.
 */

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 });
    }

    const body = await request.text();

    // Verify signature using Web Crypto
    let event;
    try {
      event = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return new Response(`Signature verification failed: ${err.message}`, { status: 400 });
    }

    try {
      await handleStripeEvent(event, env);
    } catch (err) {
      return new Response(`Error handling event: ${err.message}`, { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

/**
 * Stripe signature verification using Web Crypto
 */
async function verifyStripeSignature(payload, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const expected = signature.split(",").find((v) => v.startsWith("v1="))?.slice(3);
  if (!expected) throw new Error("Invalid signature header");

  const signatureBytes = hexToBytes(expected);
  const signedPayload = encoder.encode(payload);

  const verified = await crypto.subtle.verify("HMAC", key, signatureBytes, signedPayload);
  if (!verified) throw new Error("Invalid signature");

  return JSON.parse(payload);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Event Handler
 */
async function handleStripeEvent(event, env) {
  const type = event.type;
  const obj = event.data?.object;

  // Whale sale detection — $950 = 95000 cents
  if (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created"
  ) {
    const amount =
      obj?.amount_total ??
      obj?.plan?.amount ??
      null;

    if (amount === 95000) {
      const email =
        obj?.customer_details?.email ||
        obj?.customer_email ||
        obj?.customer ||
        "unknown";

      const metadata = obj?.metadata || {};

      const whalePayload = {
        type,
        amount,
        email,
        metadata,
        timestamp: new Date().toISOString(),
        message: "Whale sale detected",
      };

      await fetch(env.WHALE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(whalePayload),
      });
    }
  }
}
--9f436704b5ff716cd8fe624e75b39d895d6faa3ae354a5a7d91995f682b7--
