#!/usr/bin/env tsx
/**
 * scripts/test-crm-events.ts
 * Tests CRM event handlers against real/mock CRM endpoint.
 *
 * Usage:
 *   npx tsx scripts/test-crm-events.ts
 *
 * Requires env vars:
 *   CRM_BASE_URL, CRM_API_KEY
 *   (optionally SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY for full handler path)
 */

import 'dotenv/config';

// ---------------------------------------------------------------------------
// Dynamic import to avoid path-alias issues when run directly
// ---------------------------------------------------------------------------
async function run() {
  const { onNewSubscription, onDispensaryBatchCreated, onHighValueVerification } =
    await import('../server/crm/events');

  console.log('\n=== CRM Event Handler Tests ===\n');

  // --- Test 1: onNewSubscription -------------------------------------------
  console.log('[1] onNewSubscription (AuthiChain Pro, authichain.com)');
  try {
    await onNewSubscription({
      email: 'founder@brand.com',
      plan_id: 'authichain_pro',
      brand: 'authichain.com',
      stripe_customer_id: 'cus_test_001',
      mrr_usd: 49900,
    });
    console.log('    PASS: onNewSubscription completed without error');
  } catch (err) {
    console.error('    FAIL:', err);
  }

  // --- Test 2: onHighValueVerification -------------------------------------
  console.log('[2] onHighValueVerification (authichain.com, valid scan)');
  try {
    await onHighValueVerification({
      seal_id: '00000000-0000-0000-0000-000000000001',
      brand: 'authichain.com',
      scan_count: 50,
    });
    console.log('    PASS: onHighValueVerification completed without error');
  } catch (err) {
    console.error('    FAIL:', err);
  }

  // --- Test 3: onDispensaryBatchCreated ------------------------------------
  console.log('[3] onDispensaryBatchCreated (strainchain.io, disp_test)');
  try {
    await onDispensaryBatchCreated({
      brand: 'strainchain.io',
      dispensary_id: 'disp_test_001',
      batch_id: 'batch_test_001',
    });
    console.log('    PASS: onDispensaryBatchCreated completed without error');
  } catch (err) {
    console.error('    FAIL:', err);
  }

  // --- Test 4: onNewSubscription (StrainChain) -----------------------------
  console.log('[4] onNewSubscription (StrainChain Pro, strainchain.io)');
  try {
    await onNewSubscription({
      email: 'dispensary@roscommon.com',
      plan_id: 'authichain_pro',
      brand: 'strainchain.io',
      stripe_customer_id: 'cus_test_002',
      mrr_usd: 49900,
    });
    console.log('    PASS: StrainChain onNewSubscription completed');
  } catch (err) {
    console.error('    FAIL:', err);
  }

  console.log('\n=== All CRM tests complete ===\n');
  console.log('Check your CRM dashboard to confirm:');
  console.log('  - Contact created for founder@brand.com');
  console.log('  - Deal "AuthiChain Subscription" (Pro, $499/mo) created');
  console.log('  - Deal "Brand Protection" advanced with scan_volume=50');
  console.log('  - Deal "StrainChain Pilot" (Active) for disp_test_001');
  console.log('  - Contact created for dispensary@roscommon.com');
}

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
