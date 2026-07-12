#!/usr/bin/env node

/**
 * Funnel Reporting Script
 *
 * Generates conversion funnel analysis for the last 30 days.
 * Shows drop-off rates at each stage and identifies bottlenecks.
 *
 * Usage:
 *   pnpm tsx scripts/funnel-report.ts
 *   pnpm tsx scripts/funnel-report.ts --days 7
 *   pnpm tsx scripts/funnel-report.ts --source gov_engine
 *   pnpm tsx scripts/funnel-report.ts --days 7 --source linkedin_post
 */

import { createClient } from '@supabase/supabase-js';

const FUNNEL_STAGES = [
  'proposal_sent',
  'email_opened',
  'link_clicked',
  'visit_landing_page',
  'start_checkout',
  'complete_checkout',
  'subscribe',
] as const;

const ALL_SOURCES = [
  'gov_engine',
  'linkedin_post',
  'reddit_post',
  'seo',
  'direct',
  'email',
  'affiliate',
] as const;

interface FunnelData {
  [stage: string]: number;
}

interface FunnelReport {
  source: string;
  timeRange: string;
  totalProspects: number;
  funnel: Array<{
    stage: string;
    count: number;
    percentOfPrevious: number | null;
    percentOfTotal: number;
    dropOffRate: number | null;
  }>;
  bottleneck: {
    stage: string;
    dropOffRate: number;
  } | null;
}

async function getFunnelReport(
  daysBack: number = 30,
  filterSource?: string
): Promise<FunnelReport[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysBack);

  const reports: FunnelReport[] = [];

  // Query for each source
  const sources = filterSource ? [filterSource] : ALL_SOURCES;

  for (const source of sources) {
    // Get all events for this source in the date range
    const { data: events, error } = await supabase
      .from('funnel_events')
      .select('prospect_id, stage')
      .eq('source', source)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      console.error(`Error fetching funnel events for ${source}:`, error);
      continue;
    }

    if (!events || events.length === 0) {
      continue;
    }

    // Build unique prospect tracking at each stage
    const prospectsByStage: FunnelData = {};
    const prospectSet = new Set<string>();

    // Count prospects at each stage
    for (const stage of FUNNEL_STAGES) {
      const prospectAtStage = new Set<string>();
      for (const event of events) {
        if (event.stage === stage || FUNNEL_STAGES.indexOf(stage) >= FUNNEL_STAGES.indexOf(event.stage as any)) {
          prospectAtStage.add(event.prospect_id);
        }
      }
      prospectsByStage[stage] = prospectAtStage.size;
      if (prospectsByStage[stage] > 0) {
        prospectSet.add(stage);
      }
    }

    // Build funnel array with conversion rates
    const funnelArray = FUNNEL_STAGES.map((stage, index) => {
      const count = prospectsByStage[stage] || 0;
      const totalProspects = prospectsByStage[FUNNEL_STAGES[0]] || 1;
      const percentOfTotal = totalProspects > 0 ? (count / totalProspects) * 100 : 0;

      let percentOfPrevious: number | null = null;
      let dropOffRate: number | null = null;

      if (index > 0) {
        const previousCount = prospectsByStage[FUNNEL_STAGES[index - 1]] || 0;
        if (previousCount > 0) {
          percentOfPrevious = (count / previousCount) * 100;
          dropOffRate = 100 - percentOfPrevious;
        }
      }

      return {
        stage,
        count,
        percentOfPrevious,
        percentOfTotal,
        dropOffRate,
      };
    });

    // Find bottleneck (highest drop-off rate)
    let bottleneck: { stage: string; dropOffRate: number } | null = null;
    for (const item of funnelArray) {
      if (
        item.dropOffRate !== null &&
        item.dropOffRate > (bottleneck?.dropOffRate ?? 0)
      ) {
        bottleneck = { stage: item.stage, dropOffRate: item.dropOffRate };
      }
    }

    reports.push({
      source,
      timeRange: `Last ${daysBack} days (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`,
      totalProspects: prospectsByStage[FUNNEL_STAGES[0]] || 0,
      funnel: funnelArray,
      bottleneck,
    });
  }

  return reports;
}

function printReport(report: FunnelReport) {
  console.log('\n' + '═'.repeat(90));
  console.log(`Source: ${report.source.toUpperCase()}`);
  console.log(`Period: ${report.timeRange}`);
  console.log(`Total Prospects: ${report.totalProspects}`);
  console.log('═'.repeat(90));

  if (report.totalProspects === 0) {
    console.log('No funnel events recorded for this source in the time period.\n');
    return;
  }

  // Print funnel table
  console.log(
    '\n' +
      'Stage'.padEnd(25) +
      'Count'.padEnd(10) +
      'Total %'.padEnd(10) +
      'Prev %'.padEnd(10) +
      'Drop-off'
  );
  console.log('-'.repeat(65));

  for (const item of report.funnel) {
    if (item.count > 0) {
      const totalPercent = item.percentOfTotal.toFixed(1) + '%';
      const prevPercent =
        item.percentOfPrevious !== null
          ? item.percentOfPrevious.toFixed(1) + '%'
          : '-';
      const dropOff =
        item.dropOffRate !== null ? item.dropOffRate.toFixed(1) + '%' : '-';

      console.log(
        item.stage.padEnd(25) +
          item.count.toString().padEnd(10) +
          totalPercent.padEnd(10) +
          prevPercent.padEnd(10) +
          dropOff
      );
    }
  }

  // Print bottleneck analysis
  if (report.bottleneck) {
    console.log('\n' + '─'.repeat(65));
    console.log(
      `BOTTLENECK: ${report.bottleneck.stage} (${report.bottleneck.dropOffRate.toFixed(1)}% drop-off)`
    );
    console.log(
      'Action: Review messaging, creative, or targeting at this stage.'
    );
  }
}

function printComparativeAnalysis(reports: FunnelReport[]) {
  if (reports.length === 0) {
    console.log('\nNo data available for comparison.');
    return;
  }

  if (reports.length === 1) {
    return; // No comparison needed for single source
  }

  console.log('\n' + '═'.repeat(90));
  console.log('COMPARATIVE ANALYSIS');
  console.log('═'.repeat(90));

  // Compare all sources' email open rate
  console.log('\nEmail Open Rate Comparison:');
  console.log('-'.repeat(65));

  const emailOpenRates = reports.map((r) => {
    const emailOpenEvent = r.funnel.find((f) => f.stage === 'email_opened');
    const proposalSentEvent = r.funnel.find((f) => f.stage === 'proposal_sent');
    const rate =
      proposalSentEvent && proposalSentEvent.count > 0
        ? ((emailOpenEvent?.count || 0) / proposalSentEvent.count) * 100
        : 0;
    return { source: r.source, rate };
  });

  emailOpenRates.sort((a, b) => b.rate - a.rate);
  for (const { source, rate } of emailOpenRates) {
    console.log(
      `${source.padEnd(20)} ${rate.toFixed(1)}%`.padEnd(30) +
        (rate > 10 ? '✓ Good' : '⚠ Low - Review subject line')
    );
  }

  // Compare conversion rates (complete_checkout to subscribe)
  console.log('\nCheckout to Subscribe Conversion:');
  console.log('-'.repeat(65));

  const conversionRates = reports.map((r) => {
    const checkoutEvent = r.funnel.find((f) => f.stage === 'complete_checkout');
    const subscribeEvent = r.funnel.find((f) => f.stage === 'subscribe');
    const rate =
      checkoutEvent && checkoutEvent.count > 0
        ? ((subscribeEvent?.count || 0) / checkoutEvent.count) * 100
        : 0;
    return { source: r.source, rate, checkouts: checkoutEvent?.count || 0 };
  });

  conversionRates.sort((a, b) => b.rate - a.rate);
  for (const { source, rate, checkouts } of conversionRates) {
    const status =
      rate === 0 && checkouts === 0
        ? '- No checkouts'
        : rate > 50
        ? '✓ Strong'
        : '⚠ Needs improvement';
    console.log(
      `${source.padEnd(20)} ${rate.toFixed(1)}% (${checkouts} checkouts)`.padEnd(
        45
      ) + status
    );
  }
}

async function main() {
  // Parse CLI arguments
  let daysBack = 30;
  let filterSource: string | undefined;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      daysBack = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--source' && args[i + 1]) {
      filterSource = args[i + 1];
      i++;
    }
  }

  console.log('Generating funnel report...\n');

  try {
    const reports = await getFunnelReport(daysBack, filterSource);

    if (reports.length === 0) {
      console.log('No funnel events found for the specified criteria.');
      process.exit(0);
    }

    // Print individual reports
    for (const report of reports) {
      printReport(report);
    }

    // Print comparative analysis if multiple sources
    if (reports.length > 1) {
      printComparativeAnalysis(reports);
    }

    console.log('\n' + '═'.repeat(90));
    console.log('Report generated at:', new Date().toISOString());
    console.log('═'.repeat(90) + '\n');
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

main();
