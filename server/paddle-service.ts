import { ENV } from "./_core/env";
import type { Paddle as PaddleType } from "@paddle/paddle-node-sdk";

let _paddle: PaddleType | null = null;

async function getPaddleSDK() {
  const sdk = await import("@paddle/paddle-node-sdk");
  return sdk;
}

export async function getPaddle(): Promise<PaddleType> {
  if (!_paddle) {
    if (!ENV.paddleApiKey) throw new Error("PADDLE_API_KEY is not configured");
    const { Paddle, Environment } = await getPaddleSDK();
    _paddle = new Paddle(ENV.paddleApiKey, {
      environment: ENV.isProduction ? Environment.production : Environment.sandbox,
    });
  }
  return _paddle;
}

export interface PaddleCustomerInput {
  email: string;
  name?: string;
  userId: number;
}

export async function upsertPaddleCustomer(input: PaddleCustomerInput): Promise<string> {
  const paddle = await getPaddle();
  const customers = await paddle.customers.list({ email: [input.email] });
  const existing = customers.data?.[0];
  if (existing) return existing.id;
  const customer = await paddle.customers.create({
    email: input.email,
    name: input.name,
    customData: { userId: String(input.userId) },
  });
  return customer.id;
}

export interface PaddleTransactionInput {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl?: string;
}

export async function createPaddleTransaction(input: PaddleTransactionInput): Promise<string> {
  const paddle = await getPaddle();
  const transaction = await paddle.transactions.create({
    items: [{ priceId: input.priceId, quantity: 1 }],
    customerId: input.customerId,
    checkoutUrl: input.successUrl,
  });
  return (transaction as any).checkout?.url || "";
}

export async function cancelPaddleSubscription(subscriptionId: string): Promise<void> {
  const paddle = await getPaddle();
  await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: "next_billing_period" });
}

export async function verifyPaddleWebhook(rawBody: string, signature: string): Promise<boolean> {
  if (!ENV.paddleWebhookSecret) return false;
  try {
    const paddle = await getPaddle();
    const event = await paddle.webhooks.unmarshal(rawBody, ENV.paddleWebhookSecret, signature);
    return !!event;
  } catch {
    return false;
  }
}
