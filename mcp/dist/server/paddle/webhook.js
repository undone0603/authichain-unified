import { getPaddle } from '../paddle-service';
import { ENV } from '../_core/env';
import { logActivity, logAutomationAudit, hasWebhookEventProcessed, recordRevenue, upsertPaddleSubscription, setSubscriptionStatusByPaddleId, createSystemNotification, createInvoice, } from '../db';
import { getPlanQuota } from '../stripe-products';
function detectPlanFromPaddleData(priceId, amountCents) {
    if (priceId) {
        const lower = priceId.toLowerCase();
        if (lower.includes("enterprise"))
            return "enterprise";
        if (lower.includes("professional") || lower.includes("pro"))
            return "professional";
        if (lower.includes("starter"))
            return "starter";
    }
    if (amountCents >= 70000)
        return "enterprise";
    if (amountCents >= 15000)
        return "professional";
    return "starter";
}
/**
 * Paddle webhook handler
 * Processes payment events from Paddle
 */
export async function handlePaddleWebhook(req, res) {
    const signature = req.headers['paddle-signature'];
    const rawBody = req.body.toString();
    const webhookSecret = ENV.paddleWebhookSecret;
    if (!webhookSecret) {
        console.error('[Paddle Webhook] Webhook secret not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!signature) {
        console.error('[Paddle Webhook] Missing signature header');
        return res.status(401).json({ error: 'Missing signature' });
    }
    let eventData;
    try {
        const paddle = await getPaddle();
        eventData = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
    }
    catch {
        console.error('[Paddle Webhook] Invalid signature or malformed payload');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    if (!eventData) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    console.log(`[Paddle Webhook] Received event: ${eventData.eventType}`);
    // Idempotency — skip if already processed
    const paddleEventId = `${eventData.eventType}:${eventData.data?.id ?? 'unknown'}`;
    if (await hasWebhookEventProcessed(paddleEventId)) {
        console.log(`[Paddle Webhook] Duplicate event ignored: ${paddleEventId}`);
        return res.json({ received: true, duplicate: true });
    }
    await logActivity({
        userId: null,
        action: 'webhook_received',
        entityType: 'webhook',
        entityId: 0,
        details: { eventId: paddleEventId, type: eventData.eventType },
    });
    try {
        switch (eventData.eventType) {
            case 'transaction.completed':
                await handleTransactionCompleted(eventData.data);
                break;
            case 'transaction.paid':
                // Payment captured — fires before transaction.completed; no action needed
                break;
            case 'transaction.payment_failed':
                await handleTransactionPaymentFailed(eventData.data);
                break;
            case 'subscription.created':
                await handleSubscriptionCreated(eventData.data);
                break;
            case 'subscription.updated':
                await handleSubscriptionUpdated(eventData.data);
                break;
            case 'subscription.canceled':
                await handleSubscriptionCanceled(eventData.data);
                break;
            default:
                console.log(`[Paddle Webhook] Unhandled event type: ${eventData.eventType}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error('[Paddle Webhook] Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}
async function handleTransactionCompleted(data) {
    console.log(`[Paddle] Transaction completed: ${data.id}`);
    const customData = data.customData || {};
    const userId = customData.userId ? parseInt(customData.userId) : null;
    const firstItem = data.items?.[0];
    const priceId = firstItem?.price?.id ?? null;
    const amountCents = data.details?.totals?.total ? parseInt(data.details.totals.total) : 0;
    const amountUsd = amountCents / 100;
    const currency = (data.currencyCode ?? 'USD').toUpperCase();
    const plan = detectPlanFromPaddleData(priceId, amountCents);
    if (amountUsd > 0) {
        await recordRevenue({
            source: 'paddle',
            amount: amountUsd.toFixed(2),
            currency,
            type: 'subscription',
            userId: userId ?? null,
            metadata: {
                eventType: 'transaction.completed',
                transactionId: data.id,
                paddleCustomerId: data.customerId ?? null,
                plan,
            },
        });
    }
    if (userId) {
        await createInvoice({
            userId,
            amount: amountUsd.toFixed(2),
            currency,
            status: 'paid',
        });
    }
    await logAutomationAudit('billing_paddle_transaction_completed', {
        transactionId: data.id,
        amountUsd,
        currency,
        plan,
        userId: userId ?? null,
    }, userId ?? undefined);
    console.log(`[Paddle] Transaction completed recorded: ${data.id} amount=${amountUsd}`);
}
async function handleTransactionPaymentFailed(data) {
    console.log(`[Paddle] Transaction payment failed: ${data.id}`);
    const customData = data.customData || {};
    const userId = customData.userId ? parseInt(customData.userId) : null;
    const subscriptionId = data.subscriptionId ?? null;
    if (subscriptionId) {
        await setSubscriptionStatusByPaddleId(subscriptionId, 'past_due');
    }
    if (userId) {
        await createSystemNotification(userId, 'Payment Failed', 'A payment for your AuthiChain subscription failed. Please update your payment method to avoid service interruption.', 'alert', '/subscriptions');
    }
    await logAutomationAudit('billing_paddle_payment_failed', {
        transactionId: data.id,
        paddleSubscriptionId: subscriptionId ?? null,
        userId: userId ?? null,
    }, userId ?? undefined);
}
async function handleSubscriptionCreated(data) {
    console.log(`[Paddle] Subscription created: ${data.id}`);
    const customData = data.customData || {};
    const userId = customData.userId ? parseInt(customData.userId) : null;
    if (!userId) {
        console.error('[Paddle] Missing userId in subscription metadata');
        return;
    }
    const firstItem = data.items?.[0];
    const priceId = firstItem?.price?.id ?? null;
    const amountCents = firstItem?.price?.unitPrice?.amount ? parseInt(firstItem.price.unitPrice.amount) : 0;
    const plan = detectPlanFromPaddleData(priceId, amountCents);
    const billingCycle = firstItem?.price?.billingCycle?.interval === 'year' ? 'annual' : 'monthly';
    const now = new Date();
    const periodEnd = data.currentBillingPeriod?.endsAt
        ? new Date(data.currentBillingPeriod.endsAt)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const periodStart = data.currentBillingPeriod?.startsAt
        ? new Date(data.currentBillingPeriod.startsAt)
        : now;
    await upsertPaddleSubscription({
        userId,
        plan,
        status: 'active',
        monthlyQuota: getPlanQuota(plan),
        billingCycle,
        paddleCustomerId: data.customerId ?? null,
        paddleSubscriptionId: data.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
    });
    await createSystemNotification(userId, 'Subscription Activated', `Your AuthiChain ${plan} plan is now active. Welcome!`, 'subscription', '/subscriptions');
    await logAutomationAudit('billing_paddle_subscription_created', {
        paddleSubscriptionId: data.id,
        paddleCustomerId: data.customerId ?? null,
        plan,
        billingCycle,
        userId,
    }, userId);
    console.log(`[Paddle] Subscription created: ${data.id} user=${userId} plan=${plan}`);
}
async function handleSubscriptionUpdated(data) {
    console.log(`[Paddle] Subscription updated: ${data.id}`);
    const firstItem = data.items?.[0];
    const priceId = firstItem?.price?.id ?? null;
    const amountCents = firstItem?.price?.unitPrice?.amount ? parseInt(firstItem.price.unitPrice.amount) : 0;
    const plan = detectPlanFromPaddleData(priceId, amountCents);
    const paddleStatusMap = {
        active: 'active',
        trialing: 'trialing',
        past_due: 'past_due',
        paused: 'paused',
        canceled: 'cancelled',
    };
    const status = paddleStatusMap[data.status] ?? 'active';
    const customData = data.customData || {};
    const userId = customData.userId ? parseInt(customData.userId) : null;
    const now = new Date();
    const periodEnd = data.currentBillingPeriod?.endsAt
        ? new Date(data.currentBillingPeriod.endsAt)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const periodStart = data.currentBillingPeriod?.startsAt
        ? new Date(data.currentBillingPeriod.startsAt)
        : now;
    const billingCycle = firstItem?.price?.billingCycle?.interval === 'year' ? 'annual' : 'monthly';
    if (userId) {
        await upsertPaddleSubscription({
            userId,
            plan,
            status,
            monthlyQuota: getPlanQuota(plan),
            billingCycle,
            paddleCustomerId: data.customerId ?? null,
            paddleSubscriptionId: data.id,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
        });
    }
    else {
        await setSubscriptionStatusByPaddleId(data.id, status);
    }
    await logAutomationAudit('billing_paddle_subscription_updated', {
        paddleSubscriptionId: data.id,
        plan,
        status,
        userId: userId ?? null,
    }, userId ?? undefined);
    console.log(`[Paddle] Subscription updated: ${data.id} status=${status} plan=${plan}`);
}
async function handleSubscriptionCanceled(data) {
    console.log(`[Paddle] Subscription canceled: ${data.id}`);
    const customData = data.customData || {};
    const userId = customData.userId ? parseInt(customData.userId) : null;
    const cancelledAt = data.canceledAt ? new Date(data.canceledAt) : new Date();
    await setSubscriptionStatusByPaddleId(data.id, 'cancelled', cancelledAt);
    if (userId) {
        await createSystemNotification(userId, 'Subscription Cancelled', 'Your AuthiChain subscription has been cancelled. You will retain access until the end of your billing period.', 'subscription', '/subscriptions');
    }
    await logAutomationAudit('billing_paddle_subscription_cancelled', {
        paddleSubscriptionId: data.id,
        paddleCustomerId: data.customerId ?? null,
        cancelledAt: cancelledAt.toISOString(),
        userId: userId ?? null,
    }, userId ?? undefined);
    console.log(`[Paddle] Subscription cancelled: ${data.id}`);
}
