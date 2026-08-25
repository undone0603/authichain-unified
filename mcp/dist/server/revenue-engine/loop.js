/**
 * Revenue Engine — Orchestration loop.
 * Entry points called by Worker routes and Next.js API routes.
 * Each function fans out to the appropriate handlers.
 */
import { randomUUID } from 'crypto';
import { handleVerificationEvent, handleCertificateMint, handleDispensaryScan, handleSubscriptionCreated, handlePaymentFailed, } from './handlers';
// ---------------------------------------------------------------------------
// Loop A: Product Authentication SaaS
// ---------------------------------------------------------------------------
export async function onVerificationEvent(input) {
    const event = {
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
export async function onCertificateMint(input) {
    const event = {
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
export async function onDispensaryScan(input) {
    const event = {
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
export async function onNewSubscription(input) {
    const event = {
        ...input,
        type: 'subscription_created',
        id: randomUUID(),
        created_at: new Date().toISOString(),
    };
    await handleSubscriptionCreated(event);
}
export async function onPaymentFailed(input) {
    const event = {
        ...input,
        type: 'payment_failed',
        id: randomUUID(),
        created_at: new Date().toISOString(),
    };
    await handlePaymentFailed(event);
}
