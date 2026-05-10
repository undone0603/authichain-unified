import { Request, Response } from 'express';
import { verifyPaddleWebhook } from '../_core/paddle';
import { EventName } from '@paddle/paddle-node-sdk';
import { ENV } from '../_core/env';

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

  console.log(`[Paddle Webhook] Received event: ${eventData.eventType}`);

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

    res.json({ received: true });
  } catch (error) {
    console.error('[Paddle Webhook] Error processing webhook:', error);
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

  if (!userId || !productType) {
    console.error('[Paddle] Missing required metadata in transaction');
    return;
  }

  // TODO: Create authentication certificate record in database
  // TODO: Mint NFT certificate on blockchain
  // TODO: Send confirmation email with certificate details

  console.log(`[Paddle] Created authentication certificate for user ${userId}`);
}

/**
 * Handle transaction.paid event
 * Fired when payment is captured for a transaction
 */
async function handleTransactionPaid(data: any) {
  console.log(`[Paddle] Transaction paid: ${data.id}`);
  
  // Payment successful - transaction is now paid
  // This fires before transaction.completed
}

/**
 * Handle transaction.payment_failed event
 * Fired when payment fails for a transaction
 */
async function handleTransactionPaymentFailed(data: any) {
  console.log(`[Paddle] Transaction payment failed: ${data.id}`);

  // TODO: Send payment failed email
  // TODO: Update transaction status in database
  // TODO: Notify user to update payment method
}

/**
 * Handle subscription.created event
 * Fired when a subscription is created
 */
async function handleSubscriptionCreated(data: any) {
  console.log(`[Paddle] Subscription created: ${data.id}`);

  const metadata = data.customData || {};
  const userId = metadata.userId ? parseInt(metadata.userId) : null;

  if (!userId) {
    console.error('[Paddle] Missing userId in subscription metadata');
    return;
  }

  // TODO: Create subscription record in database
  // TODO: Grant subscription access
  // TODO: Send welcome email
}

/**
 * Handle subscription.updated event
 * Fired when a subscription is updated
 */
async function handleSubscriptionUpdated(data: any) {
  console.log(`[Paddle] Subscription updated: ${data.id}`);

  // TODO: Update subscription record in database
  // TODO: Handle plan changes
  // TODO: Update user access
}

/**
 * Handle subscription.canceled event
 * Fired when a subscription is canceled
 */
async function handleSubscriptionCanceled(data: any) {
  console.log(`[Paddle] Subscription canceled: ${data.id}`);

  const metadata = data.customData || {};
  const userId = metadata.userId ? parseInt(metadata.userId) : null;

  if (!userId) {
    console.error('[Paddle] Missing userId in subscription metadata');
    return;
  }

  // TODO: Update subscription status in database
  // TODO: Revoke subscription access (at end of billing period)
  // TODO: Send cancellation confirmation email
}
