import { Request, Response } from 'express';
import { verifyPaddleWebhook } from '../_core/paddle';
import { EventName } from '@paddle/paddle-node-sdk';
import { ENV } from '../_core/env';
import {
  createCertificate,
  createSubscription,
  updateSubscription,
  updateUser,
  logActivity,
  setSubscriptionStatusByPaddleId,
  claimWebhookEvent,
  markWebhookEventProcessed,
} from '../db';
import { mintAuthenticationNFT, buildAuthCertificateMetadata } from '../thirdweb';

/**
 * Paddle webhook handler
 * Processes payment events from Paddle
 */
export async function handlePaddleWebhook(req: Request, res: Response) {
  const signature = req.headers['paddle-signature'] as string;
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

  // Verify webhook signature
  const eventData = await verifyPaddleWebhook(rawBody, signature, webhookSecret);

  if (!eventData) {
    console.error('[Paddle Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  console.log(`[Paddle Webhook] Received event: ${eventData.eventType} (${eventData.notificationId})`);

  if (!eventData.notificationId) {
    console.error('[Paddle Webhook] Missing notification_id — cannot dedup');
    return res.status(400).json({ error: 'Missing notification_id' });
  }

  // Idempotency — atomic claim against UNIQUE(provider, eventId).
  // Paddle's notification_id is reused on retries, so it's the right dedup key.
  // Without this, double-delivery causes double NFT mints (gas-burning) and
  // double certificate rows in handleTransactionCompleted.
  const claimed = await claimWebhookEvent('paddle', eventData.notificationId, eventData.eventType);
  if (!claimed) {
    console.log(`[Paddle Webhook] Duplicate notification ignored: ${eventData.notificationId}`);
    return res.json({ received: true, duplicate: true });
  }

  try {
    // Handle different event types
    switch (eventData.eventType) {
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(eventData.data);
        break;

      case EventName.TransactionPaid:
        await handleTransactionPaid(eventData.data);
        break;

      case EventName.TransactionPaymentFailed:
        await handleTransactionPaymentFailed(eventData.data);
        break;

      case EventName.SubscriptionCreated:
        await handleSubscriptionCreated(eventData.data);
        break;

      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpdated(eventData.data);
        break;

      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(eventData.data);
        break;

      default:
        console.log(`[Paddle Webhook] Unhandled event type: ${eventData.eventType}`);
    }

    // Side effects ran successfully — stamp the claim. Rows left with
    // processedAt = NULL indicate handlers that crashed mid-processing.
    await markWebhookEventProcessed('paddle', eventData.notificationId);
    res.json({ received: true });
  } catch (error) {
    console.error('[Paddle Webhook] Error processing webhook:', error);
    // Note: we deliberately do NOT mark processed on error — the row stays
    // NULL so retries can re-claim. But the original claim row blocks the
    // immediate retry. Paddle will retry with the same notification_id, and
    // the next claim will fail (UNIQUE conflict) — meaning a one-shot failure
    // here means the event is permanently dropped. This is a known trade-off
    // documented in docs/superpowers/plans/2026-04-27-webhook-idempotency.md
    // ("never double-execute" wins over "always eventually execute"). Stuck
    // NULL rows surface in ops alerting for manual intervention.
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Handle transaction.completed event
 * Fired when a transaction is completed (payment successful)
 */
async function handleTransactionCompleted(data: any) {
  console.log(`[Paddle] Transaction completed: ${data.id}`);

  const metadata = data.customData || {};
  const userId = metadata.userId ? parseInt(metadata.userId) : null;
  const productType = metadata.productType; // 'authentication_certificate'
  const productId = metadata.productId ? parseInt(metadata.productId) : null;
  const authId = metadata.authenticationId ? parseInt(metadata.authenticationId) : null;

  if (!userId || !productType) {
    console.error('[Paddle] Missing required metadata in transaction');
    return;
  }

  if (productType === 'authentication_certificate' && productId && authId) {
    // 1. Create certificate record
    const certNumber = `AC-P-${Date.now()}-${data.id.substring(0, 8).toUpperCase()}`;
    const cert = await createCertificate({
      productId,
      authenticationId: authId,
      userId,
      certificateNumber: certNumber,
      status: "active",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    });

    // 2. Mint NFT on blockchain (background)
    try {
      const nftMetadata = await buildAuthCertificateMetadata({
        certificateNumber: certNumber,
        productName: metadata.productName || "Authenticated Product",
        result: metadata.result || "authentic",
        confidenceScore: metadata.confidenceScore ? parseFloat(metadata.confidenceScore) : 100,
        verificationDate: new Date().toISOString(),
        authenticatorId: authId,
      });

      const mintResult = await mintAuthenticationNFT({
        contractAddress: ENV.defaultNftContract || "",
        recipientAddress: metadata.walletAddress || "",
        metadata: nftMetadata,
        privateKey: ENV.blockchainPrivateKey || "",
      });

      console.log(`[Paddle] NFT Minted: ${mintResult.transactionHash}`);
    } catch (mintErr) {
      console.error('[Paddle] NFT Minting failed:', mintErr);
    }

    // 3. Log activity and Trigger Outreach
    await logActivity({
      userId,
      action: "certificate_purchased",
      entityType: "certificate",
      entityId: cert.id,
      details: { paddleTransactionId: data.id }
    });

    // 4. Executive Action: Push for immediate upselling/expansion
    try {
      const { createSystemNotification } = await import("../db");
      await createSystemNotification(
        userId,
        "Welcome to the Elite Network",
        "Your first certificate is live. Want to automate this for your entire inventory? Schedule a Pro session now.",
        "announcement",
        "/services"
      );
    } catch (e) { /* ignore */ }
  }

  console.log(`[Paddle] Processed transaction ${data.id} for user ${userId}`);
}

/**
 * Handle transaction.paid event
 */
async function handleTransactionPaid(data: any) {
  console.log(`[Paddle] Transaction paid: ${data.id}`);
}

/**
 * Handle transaction.payment_failed event
 */
async function handleTransactionPaymentFailed(data: any) {
  console.log(`[Paddle] Transaction payment failed: ${data.id}`);
  // In a real app, send email here
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(data: any) {
  console.log(`[Paddle] Subscription created: ${data.id}`);

  const metadata = data.customData || {};
  const userId = metadata.userId ? parseInt(metadata.userId) : null;
  const plan = metadata.plan || 'starter';

  if (!userId) {
    console.error('[Paddle] Missing userId in subscription metadata');
    return;
  }

  const quotas: Record<string, number> = { starter: 100, professional: 1000, enterprise: 10000 };

  // 1. Create subscription record
  const sub = await createSubscription({
    userId,
    plan: plan as any,
    status: "active",
    monthlyQuota: quotas[plan] || 100,
    usedQuota: 0,
    paddleSubscriptionId: data.id,
    paddleCustomerId: data.customerId,
    billingCycle: (metadata.billingCycle || "monthly") as any,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // 2. Update user plan/role
  await updateUser(userId, { role: plan === 'enterprise' ? 'brand' : 'user' });

  // 3. Log activity
  await logActivity({
    userId,
    action: "subscription_created_paddle",
    entityType: "subscription",
    entityId: sub.id,
    details: { paddleSubscriptionId: data.id, plan }
  });
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(data: any) {
  console.log(`[Paddle] Subscription updated: ${data.id}`);
  
  const plan = data.customData?.plan;
  const status = data.status; // 'active', 'past_due', etc.

  const updateData: any = { status: status };
  if (plan) {
    updateData.plan = plan;
    const quotas: Record<string, number> = { starter: 100, professional: 1000, enterprise: 10000 };
    updateData.monthlyQuota = quotas[plan] || 100;
  }

  await updateSubscription(data.id, updateData);
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(data: any) {
  console.log(`[Paddle] Subscription canceled: ${data.id}`);
  await setSubscriptionStatusByPaddleId(data.id, "cancelled", new Date());
}
