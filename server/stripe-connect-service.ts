/**
 * AuthiChain Stripe Connect Service
 *
 * AUTHORITATIVE IMPLEMENTATION BASED ON BLUEPRINT:
 * "Subscriptions and embedded payments"
 * Uses V2 Core API where applicable (as per tests).
 */
import { getStripe } from "./stripe-service";
import * as db from "./db";
import { whiteLabelClients } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * Utility to generate a stable idempotency key for a specific operation.
 */
function generateIdempotencyKey(operation: string, id: string | number) {
  return crypto.createHash("sha256").update(`${operation}-${id}`).digest("hex").slice(0, 32);
}

/**
 * Step: Create and onboard a connected account (V2 Core)
 */
export async function provisionVendorAccount(userId: number, displayName: string, email: string, countryCode = 'US') {
  const stripe = getStripe();

  // Use rawRequest for V2 Core Account as per tests
  const response = await (stripe as any).rawRequest("POST", "/v2/core/accounts", {
    display_name: displayName,
    contact_email: email,
    identity: { country: countryCode },
  }, {
    idempotencyKey: generateIdempotencyKey("provision-vendor", userId)
  });

  const body = JSON.parse((response as any).toJSON().body);
  const accountId = body.id;

  const d = await db.getDb();
  await d.update(whiteLabelClients)
    .set({ apiSecret: accountId })
    .where(eq(whiteLabelClients.userId, userId));

  return accountId;
}

/**
 * Step: Generate Onboarding Link (V2 Core)
 */
export async function generateOnboardingLink(vendorAccountId: string) {
  const stripe = getStripe();

  const response = await (stripe as any).rawRequest("POST", "/v2/core/account_links", {
    account: vendorAccountId,
    use_case: {
      type: "account_onboarding",
    },
  });

  const body = JSON.parse((response as any).toJSON().body);
  return body.url;
}

/**
 * Step: Accept embedded payments
 */
export async function createVendorCheckoutSession(vendorAccountId: string, currency = 'usd') {
  const stripe = getStripe();
  
  const session = await stripe.checkout.sessions.create({
    success_url: `${process.env.VITE_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    line_items: [
      {
        price_data: {
          currency: currency,
          product_data: { name: "AuthiChain Service Credit" },
          unit_amount: 100000 // $1,000.00
        },
        quantity: 1
      }
    ],
    mode: "payment",
    payment_method_types: ["card"],
    payment_intent_data: {
      application_fee_amount: 10000 // 10% Platform Fee
    }
  }, {
    stripeAccount: vendorAccountId,
    idempotencyKey: generateIdempotencyKey("checkout-session", `${vendorAccountId}-${Date.now().toString().slice(0, -5)}`)
  });

  return session.url;
}

/**
 * Step: Create Platform Subscription Plan
 */
export async function createPlatformSubscriptionPlan(currency = 'usd') {
  const stripe = getStripe();
  
  const product = await stripe.products.create({
    name: "Platform subscription",
    default_price_data: {
      currency: currency,
      unit_amount: 1000, // $10.00
      recurring: { interval: "month" },
    },
  });

  return product;
}

/**
 * Step: Attach Stripe Balance Payment Method
 */
export async function attachBalancePaymentMethod(vendorAccountId: string) {
  const stripe = getStripe();

  const intent = await stripe.setupIntents.create({
    payment_method_types: ["stripe_balance" as any],
    customer_account: vendorAccountId as any,
  });

  return intent.payment_method as string;
}

/**
 * Step: Subscribe Vendor to Platform
 */
export async function subscribeVendorToPlatform(vendorAccountId: string, paymentMethodId: string, priceId: string) {
  const stripe = getStripe();
  
  try {
    const subscription = await stripe.subscriptions.create({
      customer_account: vendorAccountId as any,
      default_payment_method: paymentMethodId,
      items: [{ price: priceId, quantity: 1 }],
      payment_settings: {
        payment_method_types: ["stripe_balance" as any]
      }
    }, {
      idempotencyKey: generateIdempotencyKey("vendor-sub", vendorAccountId)
    });

    return subscription;
  } catch (error: any) {
    console.error("[Stripe Connect] Subscription failed:", error.message);
    throw error;
  }
}
