import { getSystemStatus, getRegisteredJobs, getJobHistory } from '@/server/scheduled-jobs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const systemStatus = getSystemStatus();
    const jobs = getRegisteredJobs();
    const history = await getJobHistory(undefined, 30);

    // Calculate system health
    const recentJobs = (history as any[]).filter(j => j.startedAt > new Date(Date.now() - 24 * 60 * 60 * 1000));
    const failedRecent = recentJobs.filter(j => j.status === 'failed').length;
    const successRate = recentJobs.length > 0
      ? ((recentJobs.length - failedRecent) / recentJobs.length)
      : 1;

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    };

    return Response.json(
      {
        system: {
          ...systemStatus,
          healthScore: Math.round(successRate * 100),
          recentJobsLast24h: recentJobs.length,
          failuresLast24h: failedRecent,
        },
        jobs: {
          registered: jobs.length,
          enabled: jobs.filter(j => j.enabled).length,
          active: jobs.filter(j => j.isRunning).length,
          details: jobs,
        },
        recentHistory: history.slice(0, 10),
        lastUpdated: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to get system health:', error);
    return Response.json(
      { error: 'Failed to get system health', details: String(error) },
      { status: 500 }
    );
  }
}
