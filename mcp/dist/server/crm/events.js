/**
 * CRM Events — high-level event handlers that translate revenue events
 * into CRM contact + deal operations.
 */
import { crmPost } from './client';
// ---------------------------------------------------------------------------
// onNewSubscription
// Called when Stripe checkout.session.completed fires.
// ---------------------------------------------------------------------------
export async function onNewSubscription(params) {
    // 1. Upsert CRM contact
    await crmPost('/contacts/upsert', {
        email: params.email,
        stripe_customer_id: params.stripe_customer_id,
        domain: params.brand,
    });
    // 2. Create deal
    await crmPost('/deals/create', {
        brand: params.brand,
        deal_type: params.brand === 'strainchain.io'
            ? 'StrainChain Pilot'
            : params.brand === 'govchain.us'
                ? 'GovChain Contract'
                : 'AuthiChain Subscription',
        plan_id: params.plan_id,
        mrr_usd: params.mrr_usd,
        email: params.email,
        stage: 'New',
    });
}
// ---------------------------------------------------------------------------
// onDispensaryBatchCreated
// Called when /provenance Worker route inserts a new batch.
// ---------------------------------------------------------------------------
export async function onDispensaryBatchCreated(params) {
    await crmPost('/deals/update', {
        filter: { brand: params.brand, deal_type: 'StrainChain Pilot' },
        update: {
            dispensary_id: params.dispensary_id,
            batch_id: params.batch_id,
            stage: 'Active',
        },
    });
}
// ---------------------------------------------------------------------------
// onHighValueVerification
// Called when a verification event hits a high-value threshold.
// ---------------------------------------------------------------------------
export async function onHighValueVerification(params) {
    await crmPost('/deals/update', {
        filter: { brand: params.brand, deal_type: 'Brand Protection' },
        update: {
            seal_id: params.seal_id,
            scan_volume: params.scan_count,
            stage: 'Engaged',
        },
    });
}
