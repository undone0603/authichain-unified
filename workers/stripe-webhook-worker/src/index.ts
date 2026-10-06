/**
 * stripe-webhook-worker — recovered 2026-10-06 from the live Cloudflare
 * script. Safety fix only: the deployed verifyStripeSignature() always
 * returned true, so any POST was accepted as a Stripe webhook.
 *
 * Disposition: retire. Not on AUTO_DEPLOY_ALLOWLIST. workers/stripe-webhook
 * is the live handler. Do not add features here.
 */

export interface Env {
  STRIPE_WEBHOOK_SECRET?: string;
  CONSENSUS_ENGINE_URL?: string;
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return new Response("Webhook secret not configured", { status: 503 });
    }

    const signature = request.headers.get("stripe-signature");
    const body = await request.text();
    if (!(await verifyStripeSignature(body, signature, secret))) {
      return new Response("Invalid signature", { status: 400 });
    }

    let event: {
      type?: string;
      data: {
        object: {
          metadata?: {
            product_id?: string;
            product_name?: string;
            manufacturer?: string;
          };
        };
      };
    };
    try {
      event = JSON.parse(body) as typeof event;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const productData = {
        product_id: session.metadata?.product_id || "UNKNOWN",
        name: session.metadata?.product_name || "Unknown Product",
        manufacturer: session.metadata?.manufacturer || "Unknown Manufacturer",
      };
      const consensus = await verifyAuthenticity(productData, env);
      if (!consensus.consensus.reached) {
        console.error(
          "Authenticity check failed:",
          consensus.consensus.verdict
        );
        return new Response(
          "Payment processed, but authenticity check failed",
          {
            status: 202,
          }
        );
      }
      console.log("Authenticity confirmed:", consensus.consensus.seal_id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  },
};

function parseStripeSignature(
  header: string | null
): { timestamp: number; v1: string[] } | null {
  if (!header) return null;
  let timestampRaw = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestampRaw = value;
    else if (key === "v1" && value) v1.push(value);
  }
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp) || v1.length === 0) return null;
  return { timestamp, v1 };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return [...new Uint8Array(sig)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function timingSafeEqualHex(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a.toLowerCase())),
    crypto.subtle.digest("SHA-256", encoder.encode(b.toLowerCase())),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (x: BufferSource, y: BufferSource) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(leftBytes, rightBytes);
  }
  let diff = 0;
  for (let i = 0; i < leftBytes.length; i++) {
    diff |= leftBytes[i] ^ rightBytes[i];
  }
  return diff === 0;
}

export async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  const parsed = parseStripeSignature(header);
  if (!parsed) return false;

  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${body}`);

  let matched = false;
  for (const candidate of parsed.v1) {
    if (await timingSafeEqualHex(candidate, expected)) {
      matched = true;
    }
  }
  return matched;
}

async function verifyAuthenticity(
  productData: {
    product_id: string;
    name: string;
    manufacturer: string;
  },
  env: Env
) {
  const response = await fetch(env.CONSENSUS_ENGINE_URL + "/verify", {
    method: "POST",
    body: JSON.stringify(productData),
    headers: { "Content-Type": "application/json" },
  });
  return (await response.json()) as {
    consensus: { reached: boolean; verdict?: string; seal_id?: string };
  };
}
