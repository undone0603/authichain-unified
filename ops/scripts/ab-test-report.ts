#!/usr/bin/env node
/**
 * scripts/ab-test-report.ts
 *
 * A/B Testing Results Dashboard
 *
 * Compares variant A vs B conversion rates, average deal size, revenue per prospect.
 * Highlights statistical significance (Chi-squared test for p-value).
 *
 * Usage:
 *   pnpm exec ts-node scripts/ab-test-report.ts --test-id 1
 *   pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --format json
 *   pnpm exec ts-node scripts/ab-test-report.ts --test-id 1 --export report.csv
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'ts-command-line-args';
import * as fs from 'fs';

interface IArgs {
  testId: number;
  format?: string; // 'text' | 'json' | 'csv'
  export?: string; // export file path
  help?: boolean;
}

const args = parse<IArgs>(
  {
    testId: { type: Number, description: 'A/B test ID to report on' },
    format: { type: String, optional: true, defaultValue: 'text', description: 'Output format: text, json, csv' },
    export: { type: String, optional: true, description: 'Export to file' },
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

/**
 * Calculate Chi-squared test for statistical significance
 * Returns p-value (0–1). p < 0.05 = significant.
 */
function chiSquaredPValue(
  conversionsA: number,
  totalA: number,
  conversionsB: number,
  totalB: number
): number {
  // Contingency table
  const nonConversionsA = totalA - conversionsA;
  const nonConversionsB = totalB - conversionsB;

  const expected = [
    ((conversionsA + conversionsB) * totalA) / (totalA + totalB),
    ((nonConversionsA + nonConversionsB) * totalA) / (totalA + totalB),
    ((conversionsA + conversionsB) * totalB) / (totalA + totalB),
    ((nonConversionsA + nonConversionsB) * totalB) / (totalA + totalB),
  ];

  const observed = [conversionsA, nonConversionsA, conversionsB, nonConversionsB];
  let chiSquared = 0;

  for (let i = 0; i < 4; i++) {
    if (expected[i] > 0) {
      chiSquared += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }

  // Simplified p-value (1 degree of freedom)
  // Full calculation would use chi-squared CDF
  if (chiSquared < 2.706) return 0.1; // p > 0.1
  if (chiSquared < 3.841) return 0.05; // p = 0.05
  if (chiSquared < 5.024) return 0.025; // p = 0.025
  if (chiSquared < 6.635) return 0.01; // p = 0.01
  return 0.001; // p < 0.001
}

interface TestResult {
  variantA: {
    participants: number;
    conversions: number;
    conversionRate: number;
    totalRevenue: number;
    avgDealSize: number;
    emailMetrics: {
      sent: number;
      opened: number;
      openRate: number;
      clicked: number;
      clickRate: number;
      replied: number;
      replyRate: number;
    };
    linkedinMetrics: {
      impressions: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
    };
  };
  variantB: {
    participants: number;
    conversions: number;
    conversionRate: number;
    totalRevenue: number;
    avgDealSize: number;
    emailMetrics: {
      sent: number;
      opened: number;
      openRate: number;
      clicked: number;
      clickRate: number;
      replied: number;
      replyRate: number;
    };
    linkedinMetrics: {
      impressions: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
    };
  };
  winner?: string;
  significance: {
    pValue: number;
    isSignificant: boolean;
    confidence: string; // '90%', '95%', '99%'
  };
  recommendation: string;
}

async function generateReport(): Promise<TestResult> {
  console.log(`📊 A/B Test Report — Test #${args.testId}\n`);

  // Fetch test metadata
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('id', args.testId)
    .single();

  if (testError || !test) {
    console.error(`❌ Test #${args.testId} not found`);
    process.exit(1);
  }

  console.log(`Test: ${test.name}`);
  console.log(`Type: ${test.hypothesis_type || 'general'}`);
  console.log(`Status: ${test.status}`);
  console.log(`Started: ${test.started_at ? new Date(test.started_at).toLocaleDateString() : 'N/A'}`);
  if (test.ended_at) console.log(`Ended: ${new Date(test.ended_at).toLocaleDateString()}`);
  console.log('');

  // Fetch results
  const { data: results, error: resultsError } = await supabase
    .from('ab_test_results')
    .select('*')
    .eq('ab_test_id', args.testId);

  if (resultsError || !results) {
    console.error('❌ Error fetching results:', resultsError);
    process.exit(1);
  }

  // Segment by variant
  const variantAResults = results.filter((r) => r.variant_assigned === 'A');
  const variantBResults = results.filter((r) => r.variant_assigned === 'B');

  const calculateMetrics = (variant: typeof variantAResults) => {
    const conversions = variant.filter((r) => r.deal_converted).length;
    const totalRevenue = variant.reduce((sum, r) => sum + (parseFloat(r.deal_size || '0') || 0), 0);
    const avgDealSize = conversions > 0 ? totalRevenue / conversions : 0;

    const emailSent = variant.filter((r) => r.email_sent).length;
    const emailOpened = variant.filter((r) => r.email_opened).length;
    const emailClicked = variant.filter((r) => r.email_clicked).length;
    const emailReplied = variant.filter((r) => r.email_replied).length;

    const linkedinImpressions = variant.reduce((sum, r) => sum + (r.linkedin_impression || 0), 0);
    const linkedinLikes = variant.reduce((sum, r) => sum + (r.linkedin_like || 0), 0);
    const linkedinComments = variant.reduce((sum, r) => sum + (r.linkedin_comment || 0), 0);
    const linkedinShares = variant.reduce((sum, r) => sum + (r.linkedin_share || 0), 0);

    return {
      participants: variant.length,
      conversions,
      conversionRate: variant.length > 0 ? (conversions / variant.length) * 100 : 0,
      totalRevenue,
      avgDealSize,
      emailMetrics: {
        sent: emailSent,
        opened: emailOpened,
        openRate: emailSent > 0 ? (emailOpened / emailSent) * 100 : 0,
        clicked: emailClicked,
        clickRate: emailSent > 0 ? (emailClicked / emailSent) * 100 : 0,
        replied: emailReplied,
        replyRate: emailSent > 0 ? (emailReplied / emailSent) * 100 : 0,
      },
      linkedinMetrics: {
        impressions: linkedinImpressions,
        likes: linkedinLikes,
        comments: linkedinComments,
        shares: linkedinShares,
        engagementRate:
          linkedinImpressions > 0
            ? (((linkedinLikes + linkedinComments + linkedinShares) / linkedinImpressions) * 100)
            : 0,
      },
    };
  };

  const metricsA = calculateMetrics(variantAResults);
  const metricsB = calculateMetrics(variantBResults);

  // Statistical significance (Chi-squared test)
  const pValue = chiSquaredPValue(
    metricsA.conversions,
    metricsA.participants,
    metricsB.conversions,
    metricsB.participants
  );

  const isSignificant = pValue < 0.05;
  let confidence = '< 90%';
  if (pValue < 0.05) confidence = '95%';
  if (pValue < 0.01) confidence = '99%';
  if (pValue < 0.001) confidence = '99.9%';

  // Determine winner
  let winner: string | undefined;
  if (isSignificant) {
    winner = metricsA.conversionRate > metricsB.conversionRate ? 'A' : 'B';
  }

  // Generate recommendation
  const convDiff = Math.abs(metricsA.conversionRate - metricsB.conversionRate);
  let recommendation = '';

  if (metricsA.participants < 30 || metricsB.participants < 30) {
    recommendation =
      '⚠️  Small sample size (<30 per variant). Continue testing for more reliable results.';
  } else if (!isSignificant) {
    recommendation =
      '❌ No statistically significant winner yet (p > 0.05). Keep test running or increase sample size.';
  } else if (convDiff < 5) {
    recommendation =
      '✓ Significant but modest difference. Consider business context. Both viable.';
  } else if (convDiff >= 5) {
    recommendation = `🎯 **Strong winner: Variant ${winner}** (${convDiff.toFixed(1)}% difference). Ready to scale.`;
  }

  const result: TestResult = {
    variantA: metricsA as any,
    variantB: metricsB as any,
    winner,
    significance: { pValue, isSignificant, confidence },
    recommendation,
  };

  return result;
}

function formatTextReport(result: TestResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push('VARIANT A vs VARIANT B');
  lines.push('═══════════════════════════════════════════════════════════════════════════\n');

  // Conversion Rates (Key Metric)
  lines.push('📊 CONVERSION RATE (Primary Metric)');
  lines.push(`   Variant A: ${result.variantA.conversionRate.toFixed(2)}% (${result.variantA.conversions}/${result.variantA.participants})`);
  lines.push(`   Variant B: ${result.variantB.conversionRate.toFixed(2)}% (${result.variantB.conversions}/${result.variantB.participants})`);
  lines.push(
    `   Difference: ${Math.abs(result.variantA.conversionRate - result.variantB.conversionRate).toFixed(2)}%\n`
  );

  // Statistical Significance
  lines.push('📈 STATISTICAL SIGNIFICANCE');
  lines.push(`   p-value: ${result.significance.pValue.toFixed(4)}`);
  lines.push(`   Confidence: ${result.significance.confidence}`);
  lines.push(
    `   Status: ${result.significance.isSignificant ? '✅ SIGNIFICANT' : '❌ NOT SIGNIFICANT (p > 0.05)'}\n`
  );

  // Revenue Metrics
  lines.push('💰 REVENUE METRICS');
  lines.push(`   Variant A: $${result.variantA.totalRevenue.toFixed(2)} total | $${result.variantA.avgDealSize.toFixed(2)} avg deal`);
  lines.push(`   Variant B: $${result.variantB.totalRevenue.toFixed(2)} total | $${result.variantB.avgDealSize.toFixed(2)} avg deal\n`);

  // Email Metrics
  if (result.variantA.emailMetrics.sent > 0 || result.variantB.emailMetrics.sent > 0) {
    lines.push('📧 EMAIL PERFORMANCE');
    lines.push(`   Variant A:`);
    lines.push(`     • Open Rate: ${result.variantA.emailMetrics.openRate.toFixed(1)}% (${result.variantA.emailMetrics.opened}/${result.variantA.emailMetrics.sent})`);
    lines.push(`     • Click Rate: ${result.variantA.emailMetrics.clickRate.toFixed(1)}% (${result.variantA.emailMetrics.clicked}/${result.variantA.emailMetrics.sent})`);
    lines.push(`     • Reply Rate: ${result.variantA.emailMetrics.replyRate.toFixed(1)}% (${result.variantA.emailMetrics.replied}/${result.variantA.emailMetrics.sent})`);
    lines.push(`   Variant B:`);
    lines.push(`     • Open Rate: ${result.variantB.emailMetrics.openRate.toFixed(1)}% (${result.variantB.emailMetrics.opened}/${result.variantB.emailMetrics.sent})`);
    lines.push(`     • Click Rate: ${result.variantB.emailMetrics.clickRate.toFixed(1)}% (${result.variantB.emailMetrics.clicked}/${result.variantB.emailMetrics.sent})`);
    lines.push(`     • Reply Rate: ${result.variantB.emailMetrics.replyRate.toFixed(1)}% (${result.variantB.emailMetrics.replied}/${result.variantB.emailMetrics.sent})\n`);
  }

  // LinkedIn Metrics
  if (
    result.variantA.linkedinMetrics.impressions > 0 ||
    result.variantB.linkedinMetrics.impressions > 0
  ) {
    lines.push('🔗 LINKEDIN PERFORMANCE');
    lines.push(`   Variant A:`);
    lines.push(`     • Impressions: ${result.variantA.linkedinMetrics.impressions}`);
    lines.push(`     • Engagement: ${result.variantA.linkedinMetrics.engagementRate.toFixed(2)}% (Likes: ${result.variantA.linkedinMetrics.likes} | Comments: ${result.variantA.linkedinMetrics.comments} | Shares: ${result.variantA.linkedinMetrics.shares})`);
    lines.push(`   Variant B:`);
    lines.push(`     • Impressions: ${result.variantB.linkedinMetrics.impressions}`);
    lines.push(`     • Engagement: ${result.variantB.linkedinMetrics.engagementRate.toFixed(2)}% (Likes: ${result.variantB.linkedinMetrics.likes} | Comments: ${result.variantB.linkedinMetrics.comments} | Shares: ${result.variantB.linkedinMetrics.shares})\n`);
  }

  // Recommendation
  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push(result.recommendation);
  lines.push('═══════════════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

function formatJsonReport(result: TestResult): string {
  return JSON.stringify(result, null, 2);
}

function formatCsvReport(result: TestResult): string {
  const rows: string[] = [];
  rows.push(
    'metric,variant_a,variant_b,difference,winner'
  );
  rows.push(
    `conversion_rate,${result.variantA.conversionRate.toFixed(2)}%,${result.variantB.conversionRate.toFixed(2)}%,${(result.variantA.conversionRate - result.variantB.conversionRate).toFixed(2)}%,${result.winner || 'TBD'}`
  );
  rows.push(
    `participants,${result.variantA.participants},${result.variantB.participants},,`
  );
  rows.push(
    `conversions,${result.variantA.conversions},${result.variantB.conversions},,`
  );
  rows.push(
    `total_revenue,$${result.variantA.totalRevenue.toFixed(2)},$${result.variantB.totalRevenue.toFixed(2)},,`
  );
  rows.push(
    `avg_deal_size,$${result.variantA.avgDealSize.toFixed(2)},$${result.variantB.avgDealSize.toFixed(2)},,`
  );
  rows.push(
    `email_open_rate,${result.variantA.emailMetrics.openRate.toFixed(2)}%,${result.variantB.emailMetrics.openRate.toFixed(2)}%,,`
  );
  rows.push(
    `email_click_rate,${result.variantA.emailMetrics.clickRate.toFixed(2)}%,${result.variantB.emailMetrics.clickRate.toFixed(2)}%,,`
  );
  rows.push(
    `p_value,${result.significance.pValue.toFixed(4)},${result.significance.pValue.toFixed(4)},${result.significance.confidence},${result.significance.isSignificant ? 'YES' : 'NO'}`
  );

  return rows.join('\n');
}

async function main() {
  try {
    const result = await generateReport();

    let output = '';
    if (args.format === 'json') {
      output = formatJsonReport(result);
    } else if (args.format === 'csv') {
      output = formatCsvReport(result);
    } else {
      output = formatTextReport(result);
    }

    if (args.export) {
      fs.writeFileSync(args.export, output);
      console.log(`\n✅ Report exported to: ${args.export}`);
    } else {
      console.log('\n' + output);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
