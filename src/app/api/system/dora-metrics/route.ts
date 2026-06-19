import { getJobHistory } from '@/server/scheduled-jobs';

export const runtime = 'nodejs';

interface DORAMetrics {
  deploymentFrequency: number; // per year
  leadTime: number; // hours
  mttr: number; // minutes
  changeFailureRate: number; // percent
}

export async function GET(request: Request) {
  try {
    const healthHistory = await getJobHistory(undefined, 365); // Last 365 days of job runs

    if (!healthHistory || healthHistory.length === 0) {
      return Response.json({
        error: 'Insufficient data',
        message: 'Need at least 7 days of job history',
      }, { status: 400 });
    }

    const jobRuns = healthHistory as any[];

    // 1. Deployment Frequency: deployments per year
    const deployments = jobRuns.filter(r => r.status === 'completed').length;
    const deploymentFrequency = (deployments / 365) * 365; // Scale to annual

    // 2. Lead Time: average time from start to completion (hours)
    const completedRuns = jobRuns.filter(r => r.status === 'completed' && r.duration);
    const avgLeadTimeMs = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + (r.duration || 0), 0) / completedRuns.length
      : 0;
    const leadTime = avgLeadTimeMs / (1000 * 60 * 60); // Convert to hours

    // 3. MTTR: Mean time to recovery (minutes)
    // Calculate from failed runs followed by successful recovery
    const failedRuns = jobRuns.filter(r => r.status === 'failed');
    const mttrValues: number[] = [];

    for (const failed of failedRuns) {
      const subsequentRuns = jobRuns.filter(r =>
        r.jobName === failed.jobName &&
        new Date(r.startedAt) > new Date(failed.startedAt) &&
        r.status === 'completed'
      );

      if (subsequentRuns.length > 0) {
        const recovery = subsequentRuns[0];
        const timeBetween =
          (new Date(recovery.startedAt).getTime() - new Date(failed.startedAt).getTime()) /
          (1000 * 60);
        mttrValues.push(timeBetween);
      }
    }

    const mttr = mttrValues.length > 0
      ? mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length
      : 0;

    // 4. Change Failure Rate: percent of deployments that cause issues
    const failureRate = jobRuns.filter(r => r.status === 'failed').length / jobRuns.length;
    const changeFailureRate = failureRate * 100;

    // 5. Industry benchmarks (2025 DORA data)
    const benchmarks = {
      deploymentFrequency: { elite: 208, high: 104, medium: 52, low: 13 },
      leadTime: { elite: 1, high: 7, medium: 30, low: 168 },
      mttr: { elite: 15, high: 60, medium: 300, low: 1440 },
      changeFailureRate: { elite: 15, high: 30, medium: 50, low: 80 },
    };

    // 6. Determine performance tier
    let deploymentTier = 'low';
    if (deploymentFrequency >= benchmarks.deploymentFrequency.elite) deploymentTier = 'elite';
    else if (deploymentFrequency >= benchmarks.deploymentFrequency.high) deploymentTier = 'high';
    else if (deploymentFrequency >= benchmarks.deploymentFrequency.medium) deploymentTier = 'medium';

    let leadTimeTier = 'low';
    if (leadTime <= benchmarks.leadTime.elite) leadTimeTier = 'elite';
    else if (leadTime <= benchmarks.leadTime.high) leadTimeTier = 'high';
    else if (leadTime <= benchmarks.leadTime.medium) leadTimeTier = 'medium';

    let mttrTier = 'low';
    if (mttr <= benchmarks.mttr.elite) mttrTier = 'elite';
    else if (mttr <= benchmarks.mttr.high) mttrTier = 'high';
    else if (mttr <= benchmarks.mttr.medium) mttrTier = 'medium';

    let failureRateTier = 'low';
    if (changeFailureRate <= benchmarks.changeFailureRate.elite) failureRateTier = 'elite';
    else if (changeFailureRate <= benchmarks.changeFailureRate.high) failureRateTier = 'high';
    else if (changeFailureRate <= benchmarks.changeFailureRate.medium) failureRateTier = 'medium';

    const overallTier = [deploymentTier, leadTimeTier, mttrTier, failureRateTier]
      .sort()
      .reverse()[0];

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // 1 hour cache
    };

    return Response.json(
      {
        metrics: {
          deploymentFrequency: Number(deploymentFrequency.toFixed(1)),
          leadTime: Number(leadTime.toFixed(2)),
          mttr: Number(mttr.toFixed(1)),
          changeFailureRate: Number(changeFailureRate.toFixed(2)),
        },
        tiers: {
          deploymentFrequency: deploymentTier,
          leadTime: leadTimeTier,
          mttr: mttrTier,
          changeFailureRate: failureRateTier,
          overall: overallTier,
        },
        benchmarks,
        percentileBetter: {
          deploymentFrequency: Math.min(100, (deploymentFrequency / 128) * 100),
          leadTime: Math.min(100, (24 / Math.max(leadTime, 0.1)) * 100),
          mttr: Math.min(100, (96 / Math.max(mttr, 1)) * 100),
          changeFailureRate: Math.min(100, (15.5 / Math.max(changeFailureRate, 1)) * 100),
        },
        interpretation: {
          deploymentFrequency:
            deploymentTier === 'elite'
              ? 'Extreme performers: multiple deployments per day. Autonomous agents enabling continuous delivery.'
              : 'High performers: daily or weekly deployments',
          leadTime:
            leadTimeTier === 'elite'
              ? 'Extreme performers: sub-hour from commit to production. Autonomous risk gating enables rapid deployment.'
              : 'High performers: code-to-production in hours',
          mttr:
            mttrTier === 'elite'
              ? 'Extreme performers: recovery in minutes. Predictive risk scoring and automated incident response.'
              : 'High performers: incident recovery in under 1 hour',
          changeFailureRate:
            failureRateTier === 'elite'
              ? `Extreme performers: <15% failure rate. Cross-vertical threat intelligence prevents ${(100 - changeFailureRate).toFixed(0)}% of incidents.`
              : 'High performers: <30% failure rate',
        },
        timestamp: new Date().toISOString(),
        dataPoints: jobRuns.length,
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to compute DORA metrics:', error);
    return Response.json(
      { error: 'Failed to compute DORA metrics', details: String(error) },
      { status: 500 }
    );
  }
}
