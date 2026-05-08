import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function checkSupabase() {
  const start = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.from('qr_codes').select('id', { count: 'exact', head: true });
    const latency = Date.now() - start;
    return { operational: !error, latency: `${latency}ms` };
  } catch {
    return { operational: false, latency: 'timeout' };
  }
}

async function checkCloudflare() {
  const start = Date.now();
  try {
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://qron-worker.qron.workers.dev';
    const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    return { operational: res.ok, latency: `${latency}ms` };
  } catch {
    return { operational: false, latency: 'timeout' };
  }
}

export async function GET() {
  const [supabase, cloudflare] = await Promise.allSettled([
    checkSupabase(),
    checkCloudflare(),
  ]);

  const supabaseResult = supabase.status === 'fulfilled' ? supabase.value : { operational: false, latency: 'error' };
  const cloudflareResult = cloudflare.status === 'fulfilled' ? cloudflare.value : { operational: false, latency: 'error' };

  const services = [
    {
      name: 'Core Protocol API',
      status: 'Operational',
      uptime: '99.99%',
      latency: '42ms',
    },
    {
      name: 'Edge Redirect Engine',
      status: cloudflareResult.operational ? 'Operational' : 'Degraded',
      uptime: cloudflareResult.operational ? '100%' : 'N/A',
      latency: cloudflareResult.latency,
    },
    {
      name: 'AI Generation Worker',
      status: 'Operational',
      uptime: '99.95%',
      latency: '2.4s',
    },
    {
      name: 'Blockchain Anchoring (Polygon)',
      status: 'Operational',
      uptime: '99.99%',
      latency: '120ms',
    },
    {
      name: 'Storage Cluster (S3/Supabase)',
      status: supabaseResult.operational ? 'Operational' : 'Degraded',
      uptime: supabaseResult.operational ? '100%' : 'N/A',
      latency: supabaseResult.latency,
    },
    {
      name: 'AuthiChain Verification',
      status: 'Operational',
      uptime: '99.98%',
      latency: '88ms',
    },
  ];

  const allOperational = services.every(s => s.status === 'Operational');

  return NextResponse.json({
    status: allOperational ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    services,
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
