#!/usr/bin/env node
/**
 * scripts/assign-ab-variant.ts
 *
 * Assigns A/B test variants to leads randomly (50/50 split).
 * Supports email templates, LinkedIn angles, and pricing tiers.
 *
 * Usage:
 *   pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --limit 500
 *   pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --email
 *   pnpm exec ts-node scripts/assign-ab-variant.ts --test-id 1 --pricing
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'ts-command-line-args';

interface IArgs {
  testId: number;
  limit?: number;
  email?: boolean;
  linkedin?: boolean;
  pricing?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

const args = parse<IArgs>(
  {
    testId: { type: Number, description: 'A/B test ID to assign variants for' },
    limit: { type: Number, optional: true, defaultValue: 100, description: 'Max leads to assign' },
    email: { type: Boolean, optional: true, defaultValue: false, description: 'Assign email template variants' },
    linkedin: { type: Boolean, optional: true, defaultValue: false, description: 'Assign LinkedIn post variants' },
    pricing: { type: Boolean, optional: true, defaultValue: false, description: 'Assign pricing tier variants' },
    dryRun: { type: Boolean, optional: true, defaultValue: false, description: 'Preview without saving' },
    help: { type: Boolean, optional: true, defaultValue: false, description: 'Show this help message' },
  },
  {
    helpArg: 'help',
  }
);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function assignVariants() {
  console.log(`[A/B Assignment] Starting variant assignment for test #${args.testId}`);

  // Fetch the A/B test
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('id', args.testId)
    .single();

  if (testError || !test) {
    console.error(`❌ Test #${args.testId} not found:`, testError);
    process.exit(1);
  }

  console.log(`\n📋 Test: ${test.name}`);
  console.log(`   Type: ${test.hypothesis_type || 'general'}`);
  console.log(`   Status: ${test.status}`);
  console.log(`   Hypothesis: ${test.hypothesis}`);

  // Fetch unassigned leads (no ab_variant yet)
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, email, name, company, ab_variant')
    .is('ab_variant', null)
    .limit(args.limit || 100);

  if (leadsError) {
    console.error('❌ Error fetching leads:', leadsError);
    process.exit(1);
  }

  if (!leads || leads.length === 0) {
    console.log('✅ No unassigned leads found.');
    return;
  }

  console.log(`\n📊 Found ${leads.length} unassigned leads. Assigning variants...`);

  const assignments: Array<{
    id: number;
    variant: string;
    metadata: Record<string, string>;
  }> = [];

  for (const lead of leads) {
    // 50/50 random split
    const variant = Math.random() < 0.5 ? 'A' : 'B';
    const metadata: Record<string, string> = {};

    // Assign email template variant
    if (args.email) {
      metadata.email_variant = `proposal_${variant.toLowerCase()}`;
    }

    // Assign LinkedIn post variant
    if (args.linkedin) {
      metadata.linkedin_variant = variant;
    }

    // Assign pricing tier variant
    if (args.pricing) {
      // Variant A: standard pricing; Variant B: charm pricing
      const pricingTier = {
        A: { starter: 29, pro: 199, enterprise: 999 },
        B: { starter: 24, pro: 179, enterprise: 899 },
      }[variant] || { starter: 29, pro: 199, enterprise: 999 };
      metadata.pricing_tiers = JSON.stringify(pricingTier);
    }

    assignments.push({
      id: lead.id,
      variant,
      metadata,
    });
  }

  // Show sample assignments
  console.log('\n📌 Sample assignments (first 5):');
  assignments.slice(0, 5).forEach((a) => {
    console.log(
      `   Lead ${a.id}: Variant ${a.variant} → ${JSON.stringify(a.metadata)}`
    );
  });

  const variantCounts = {
    A: assignments.filter((a) => a.variant === 'A').length,
    B: assignments.filter((a) => a.variant === 'B').length,
  };
  console.log(`\n✓ Variant A: ${variantCounts.A} (${((variantCounts.A / assignments.length) * 100).toFixed(1)}%)`);
  console.log(`✓ Variant B: ${variantCounts.B} (${((variantCounts.B / assignments.length) * 100).toFixed(1)}%)`);

  if (args.dryRun) {
    console.log('\n🔍 DRY RUN: Would update', assignments.length, 'leads');
    process.exit(0);
  }

  // Batch update leads with assigned variants
  console.log(`\n💾 Saving assignments...`);
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < assignments.length; i += 100) {
    const batch = assignments.slice(i, i + 100);
    const updates = batch.map((a) => ({
      id: a.id,
      ab_test_id: args.testId,
      ab_variant: a.variant,
      ...(args.email && { email_variant_assigned: a.metadata.email_variant }),
      ...(args.linkedin && { linkedin_variant_assigned: a.variant }),
      ...(args.pricing && { pricing_tier_assigned: JSON.stringify(a.metadata.pricing_tiers) }),
      metadata: a.metadata,
      updated_at: new Date().toISOString(),
    }));

    // Use upsert to update existing leads
    const { error } = await supabase
      .from('leads')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Batch ${i / 100 + 1} error:`, error);
      failed += batch.length;
    } else {
      updated += batch.length;
    }
  }

  // Log to ab_test_results table
  console.log(`\n📝 Creating result tracking records...`);
  const resultRecords = assignments.map((a) => ({
    ab_test_id: args.testId,
    lead_id: a.id,
    variant_assigned: a.variant,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < resultRecords.length; i += 100) {
    const batch = resultRecords.slice(i, i + 100);
    const { error } = await supabase
      .from('ab_test_results')
      .insert(batch);

    if (error) {
      console.warn(`⚠️  Failed to log some results:`, error.message);
    }
  }

  // Update ab_tests totalParticipants
  const { error: updateTestError } = await supabase
    .from('ab_tests')
    .update({
      total_participants: (test.total_participants || 0) + updated,
      started_at: test.started_at || new Date().toISOString(),
      status: test.status === 'draft' ? 'running' : test.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.testId);

  if (updateTestError) {
    console.warn('⚠️  Could not update test status:', updateTestError);
  }

  console.log(`\n✅ Assignment complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total in test: ${(test.total_participants || 0) + updated}`);
}

assignVariants().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
