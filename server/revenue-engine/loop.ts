/**
 * Revenue Engine — Orchestration loop.
 * Entry points called by Worker routes and Next.js API routes.
 * Each function fans out to the appropriate handlers.
 */
import { randomUUID } from 'crypto';
import type {
  VerificationEvent,
  CertificateMintedEvent,
  ScanEvent,
  SubscriptionCreatedEvent,
  PaymentFailedEvent,
} from './events';
import {
  handleVerificationEvent,
  handleCertificateMint,
  handleDispensaryScan,
  handleSubscriptionCreated,
  handlePaymentFailed,
} from './handlers';

// ---------------------------------------------------------------------------
// Loop A: Product Authentication SaaS
// ---------------------------------------------------------------------------
export async function onVerificationEvent(
  input: Omit<VerificationEvent, 'type' | 'id' | 'created_at'>,
): Promise<void> {
  const event: VerificationEvent = {
    ...input,
    type: 'verification',
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await handleVerificationEvent(event);
}

// ---------------------------------------------------------------------------
// Loop B: Certificate Minting Marketplace
// ---------------------------------------------------------------------------
export async function onCertificateMint(
  input: Omit<CertificateMintedEvent, 'type' | 'id' | 'created_at'>,
): Promise<void> {
  const event: CertificateMintedEvent = {
    ...input,
    type: 'certificate_minted',
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await handleCertificateMint(event);
}

// ---------------------------------------------------------------------------
// Loop C: StrainChain Dispensary Pilot
// ---------------------------------------------------------------------------
export async function onDispensaryScan(
  input: Omit<ScanEvent, 'type' | 'id' | 'created_at'>,
): Promise<void> {
  const event: ScanEvent = {
    ...input,
    type: 'dispensary_scan',
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await handleDispensaryScan(event);
}

// ---------------------------------------------------------------------------
// Stripe webhook entry points
// ---------------------------------------------------------------------------
export async function onNewSubscription(
  input: Omit<SubscriptionCreatedEvent, 'type' | 'id' | 'created_at'>,
): Promise<void> {
  const event: SubscriptionCreatedEvent = {
    ...input,
    type: 'subscription_created',
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await handleSubscriptionCreated(event);
}

export async function onPaymentFailed(
  input: Omit<PaymentFailedEvent, 'type' | 'id' | 'created_at'>,
): Promise<void> {
  const event: PaymentFailedEvent = {
    ...input,
    type: 'payment_failed',
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await handlePaymentFailed(event);
}
