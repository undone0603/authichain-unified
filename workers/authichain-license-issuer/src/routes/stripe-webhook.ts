import { verifyStripeSignature } from "../utils/crypto";
import { DB } from "../services/db";
import {
  issueLicenseKey,
  hashKey,
  tierFromPriceId,
  seatsForTier,
} from "../services/license";
import {
  notifyAdminNewLicense,
  deliverKeyViaTelegram,
} from "../services/telegram";
import { deliverKeyViaEmail } from "../services/email";
import { describeLicenseBindings } from "./health";
import type { Env } from "../index";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function stripeWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  void ctx;
  if (
    !env.STRIPE_WEBHOOK_SECRET?.trim() ||
    !env.LICENSE_PRIVATE_KEY_PEM?.trim()
  ) {
    return json(503, {
      error: "license issuer is not fully bound",
      bindings: describeLicenseBindings(env),
    });
  }

  const body = await request.text();
  const header = request.headers.get("Stripe-Signature");

  if (!(await verifyStripeSignature(body, header, env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: { id?: string; type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (!event.id || !event.type) {
    return new Response("Bad request", { status: 400 });
  }

  if (await DB.isEventProcessed(env, event.id)) {
    return json(200, { status: "already_processed" });
  }

  // Process before answering Stripe. Returning 2xx from waitUntil used to
  // ack events that never wrote a D1 license (missing customer id, missing
  // signing key, line_items not expanded). Stripe will not retry a 200.
  try {
    await handleEvent(env, event);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await DB.logEvent(env, event.id, event.type, "error", message);
    return json(500, { status: "error", error: message });
  }

  return json(200, { status: "processed" });
}

async function handleEvent(
  env: Env,
  event: { id: string; type: string; data?: { object?: unknown } }
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckout(env, event.data?.object as CheckoutSession);
      break;
    case "customer.subscription.deleted":
      await handleCancellation(
        env,
        event.data?.object as { customer?: string }
      );
      break;
    default:
      break;
  }
  await DB.logEvent(env, event.id, event.type, "success", "");
}

type CheckoutSession = {
  id?: string;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
  line_items?: { data?: Array<{ price?: { id?: string } }> };
};

export async function resolveCheckoutPriceId(
  env: Env,
  session: CheckoutSession,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const fromSession =
    session.line_items?.data?.[0]?.price?.id ||
    session.metadata?.priceId ||
    session.metadata?.stripe_price_id ||
    session.metadata?.price_id ||
    "";
  if (fromSession) return fromSession;
  if (!env.STRIPE_SECRET_KEY?.trim() || !session.id) return "";

  // Read-only retrieve + expand. Does not create a charge.
  const url =
    "https://api.stripe.com/v1/checkout/sessions/" +
    encodeURIComponent(session.id) +
    "?expand[]=line_items";
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return "";
  const expanded = (await res.json()) as CheckoutSession;
  return expanded.line_items?.data?.[0]?.price?.id || "";
}

export async function handleCheckout(
  env: Env,
  session: CheckoutSession
): Promise<void> {
  const email = (
    session.customer_details?.email ??
    session.customer_email ??
    ""
  ).trim();
  if (!email) {
    throw new Error("checkout.session.completed missing customer email");
  }

  const customerId = (session.customer ?? "").trim() || `email:${email}`;
  const subscriptionId = (session.subscription ?? "").trim();
  const priceId = await resolveCheckoutPriceId(env, session);

  const tier = tierFromPriceId(env, priceId);
  const seats = seatsForTier(tier);
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const oneYear = now + 365 * 24 * 3600;

  const key = await issueLicenseKey(env, {
    sub: email,
    tier,
    seats,
    exp: oneYear,
    iat: now,
    jti,
  });

  const keyHash = await hashKey(key);

  await DB.createLicense(env, {
    id: jti,
    email,
    tier,
    seats,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    key_hash: keyHash,
    status: "active",
    expires_at: new Date(oneYear * 1000).toISOString(),
  });

  const deliveredViaTelegram = await deliverKeyViaTelegram(
    env,
    email,
    tier,
    key
  );
  if (deliveredViaTelegram) {
    await DB.markDelivered(env, jti);
  } else if (env.RESEND_API_KEY) {
    const deliveredViaEmail = await deliverKeyViaEmail(env, email, tier, key);
    if (deliveredViaEmail) {
      await DB.markDelivered(env, jti);
    }
  }
  await notifyAdminNewLicense(env, email, tier, key);
}

async function handleCancellation(
  env: Env,
  subscription: { customer?: string }
): Promise<void> {
  const customerId: string = subscription.customer ?? "";
  if (!customerId) return;

  const record = await DB.getByStripeCustomer(env, customerId);
  if (record) {
    await DB.revoke(env, record.id);
  }
}
