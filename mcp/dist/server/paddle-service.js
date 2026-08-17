import { ENV } from "./_core/env";
import { safeUrl } from "./_core/allowed-origins";
let _paddle = null;
async function getPaddleSDK() {
    const sdk = await import("@paddle/paddle-node-sdk");
    return sdk;
}
export async function getPaddle() {
    if (!_paddle) {
        if (!ENV.paddleApiKey)
            throw new Error("PADDLE_API_KEY is not configured");
        const { Paddle, Environment } = await getPaddleSDK();
        _paddle = new Paddle(ENV.paddleApiKey, {
            environment: ENV.isProduction ? Environment.production : Environment.sandbox,
        });
    }
    return _paddle;
}
export async function upsertPaddleCustomer(input) {
    const paddle = await getPaddle();
    const customers = await paddle.customers.list({ email: [input.email] });
    const existing = customers.data?.[0];
    if (existing)
        return existing.id;
    const customer = await paddle.customers.create({
        email: input.email,
        name: input.name,
        customData: { userId: String(input.userId) },
    });
    return customer.id;
}
export async function createPaddleTransaction(input) {
    const paddle = await getPaddle();
    const transaction = await paddle.transactions.create({
        items: [{ priceId: input.priceId, quantity: 1 }],
        customerId: input.customerId,
        checkout: { url: safeUrl(input.successUrl, "https://authichain.com/subscriptions?success=true") },
    });
    return transaction.checkout?.url || "";
}
export async function cancelPaddleSubscription(subscriptionId) {
    const paddle = await getPaddle();
    await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: "next_billing_period" });
}
export async function verifyPaddleWebhook(rawBody, signature) {
    if (!ENV.paddleWebhookSecret)
        return false;
    try {
        const paddle = await getPaddle();
        const event = await paddle.webhooks.unmarshal(rawBody, ENV.paddleWebhookSecret, signature);
        return !!event;
    }
    catch {
        return false;
    }
}
