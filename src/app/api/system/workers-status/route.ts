import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface WorkerStatus {
  name: string;
  domain: string;
  status: 'deployed' | 'pending' | 'error' | 'unknown';
  lastDeployment: string | null;
  buildId: string | null;
  health: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  uptime: number;
}

const WORKERS_CONFIG: Record<string, { domain: string; brand: string }> = {
  'authichain-com': { domain: 'authichain.com', brand: 'core' },
  'authichain-api': { domain: 'api.authichain.com', brand: 'core' },
  'authichain-api-gateway': { domain: 'gateway.authichain.com', brand: 'core' },
  'authichain-dashboard': { domain: 'dashboard.authichain.com', brand: 'core' },
  'authichain-automation': { domain: 'automation.authichain.com', brand: 'core' },
  'authichain-autopilot': { domain: 'autopilot.authichain.com', brand: 'core' },
  'authichain-bridge': { domain: 'bridge.authichain.com', brand: 'core' },
  'authichain-chain-data': { domain: 'chain-data.authichain.com', brand: 'core' },
  'authichain-gateway': { domain: 'worker.authichain.com', brand: 'core' },
  'authichain-infra': { domain: 'infra.authichain.com', brand: 'core' },
  'authichain-license-issuer': { domain: 'license.authichain.com', brand: 'core' },
  'authichain-qron-provenance': { domain: 'provenance.authichain.com', brand: 'qron' },
  'authichain-scan-validate': { domain: 'validate.authichain.com', brand: 'core' },
  'authichain-telegram': { domain: 'telegram.authichain.com', brand: 'core' },
  'authichain-verify-worker': { domain: 'verify.authichain.com', brand: 'core' },
  'govchain-us': { domain: 'govchain.us', brand: 'govchain' },
  'qron-space': { domain: 'qron.space', brand: 'qron' },
  'strainchain-io': { domain: 'strainchain.io', brand: 'strainchain' },
  'qron-automation': { domain: 'automation.qron.space', brand: 'qron' },
  'qron-edge': { domain: 'edge.qron.space', brand: 'qron' },
  'qron-image-gen': { domain: 'image-gen.qron.space', brand: 'qron' },
  'qron-outreach': { domain: 'outreach.qron.space', brand: 'qron' },
  'ai-classification': { domain: 'classify.authichain.com', brand: 'core' },
  'analytics': { domain: 'analytics.authichain.com', brand: 'core' },
  'auth': { domain: 'auth.authichain.com', brand: 'core' },
  'bitcoin-auth': { domain: 'bitcoin.authichain.com', brand: 'core' },
  'blockchain': { domain: 'blockchain.authichain.com', brand: 'core' },
  'outreach-queue': { domain: 'queue.authichain.com', brand: 'core' },
  'resend-relay': { domain: 'resend.authichain.com', brand: 'core' },
  'watchchain-io': { domain: 'watchchain.io', brand: 'core' },
};

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch worker metrics from monitoring table
    const { data: workerMetrics, error: metricsError } = await supabase
      .from('worker_deployments')
      .select('*')
      .order('lastDeployment', { ascending: false })
      .limit(100);

    if (metricsError) {
      console.error('Error fetching worker metrics:', metricsError);
    }

    // Build worker status map
    const statusMap = new Map<string, WorkerStatus>();

    // Initialize all known workers
    Object.entries(WORKERS_CONFIG).forEach(([name, config]) => {
      const metric = workerMetrics?.find((m: any) => m.workerName === name);
      const health = metric ? determineHealth(metric) : 'unknown';

      statusMap.set(name, {
        name,
        domain: config.domain,
        status: metric?.status || 'unknown',
        lastDeployment: metric?.lastDeployment || null,
        buildId: metric?.buildId || null,
        health: health as any,
        responseTime: metric?.responseTime || 0,
        errorRate: metric?.errorRate || 0,
        uptime: metric?.uptime || 0,
      });
    });

    // Calculate summary stats
    const allWorkers = Array.from(statusMap.values());
    const healthyCounts = {
      deployed: allWorkers.filter((w) => w.status === 'deployed').length,
      pending: allWorkers.filter((w) => w.status === 'pending').length,
      error: allWorkers.filter((w) => w.status === 'error').length,
      healthy: allWorkers.filter((w) => w.health === 'healthy').length,
      degraded: allWorkers.filter((w) => w.health === 'degraded').length,
      unhealthy: allWorkers.filter((w) => w.health === 'unhealthy').length,
    };

    const avgResponseTime =
      allWorkers.reduce((sum, w) => sum + w.responseTime, 0) / allWorkers.length || 0;
    const avgErrorRate = allWorkers.reduce((sum, w) => sum + w.errorRate, 0) / allWorkers.length || 0;
    const avgUptime = allWorkers.reduce((sum, w) => sum + w.uptime, 0) / allWorkers.length || 0;

    // Group by brand
    const byBrand: Record<string, WorkerStatus[]> = {};
    allWorkers.forEach((w) => {
      const brand = WORKERS_CONFIG[w.name]?.brand || 'unknown';
      if (!byBrand[brand]) byBrand[brand] = [];
      byBrand[brand].push(w);
    });

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    };

    return Response.json(
      {
        summary: {
          totalWorkers: allWorkers.length,
          deploymentStatus: healthyCounts,
          healthStatus: {
            healthy: healthyCounts.healthy,
            degraded: healthyCounts.degraded,
            unhealthy: healthyCounts.unhealthy,
          },
          metrics: {
            avgResponseTime: Math.round(avgResponseTime),
            avgErrorRate: Number(avgErrorRate.toFixed(2)),
            avgUptime: Number(avgUptime.toFixed(2)),
          },
        },
        workers: allWorkers,
        byBrand,
        lastUpdated: new Date().toISOString(),
      },
      { headers }
    );
  } catch (error) {
    console.error('Failed to fetch worker status:', error);
    return Response.json(
      { error: 'Failed to fetch worker status', details: String(error) },
      { status: 500 }
    );
  }
}

function determineHealth(metric: any): string {
  if (metric.status !== 'deployed') return 'unhealthy';
  if (metric.errorRate > 0.05) return 'unhealthy';
  if (metric.responseTime > 2000) return 'degraded';
  if (metric.errorRate > 0.01) return 'degraded';
  return 'healthy';
}
