// v3 - blockchain status: static operational (Polygon Mainnet active)
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
    const { error } = await supabase
      .from('qr_codes')
      .select('id', { count: 'exact', head: true });
    const latency = Date.now() - start;
    return { operational: !error, latency: `${latency}ms` };
  } catch {
    return { operational: false, latency: 'timeout' };
  }
}

async function checkCloudflare() {
  const start = Date.now();
  try {
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://qron.space';
    const res = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    const latency = Date.now() - start;
    return { operational: res.ok, latency: `${latency}ms`, configured: true };
  } catch {
    return { operational: false, latency: 'N/A', configured: false };
  }
}

// Previously returned a hardcoded `operational: true, latency: '12ms'` without
// contacting anything, so the status page reported Polygon as healthy during an
// RPC outage. Now actually asks the chain for its head block.
async function checkBlockchain() {
  const rpc = process.env.POLYGON_RPC_URL || process.env.POLYGON_RPC;
  if (!rpc) return { operational: false, latency: 'N/A', chain: 'Polygon', blockNumber: null, configured: false };

  const start = Date.now();
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(4000),
    });
    const latency = Date.now() - start;
    const json = res.ok ? ((await res.json()) as { result?: string }) : null;
    const blockNumber = json?.result ? parseInt(json.result, 16) : null;
    return {
      operational: Boolean(blockNumber),
      latency: `${latency}ms`,
      chain: 'Polygon',
      blockNumber,
      configured: true,
    };
  } catch {
    return { operational: false, latency: 'timeout', chain: 'Polygon', blockNumber: null, configured: true };
  }
}

async function checkAIWorker() {
  const start = Date.now();
  try {
    const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell', {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN || 'test'}` },
      signal: AbortSignal.timeout(4000),
    });
    const latency = Date.now() - start;
    return { operational: res.ok || res.status === 401, latency: `${latency}ms` };
  } catch {
    return { operational: false, latency: 'timeout' };
  }
}

export async function GET() {
  const handlerStart = Date.now();
  const [supabaseResult, cloudflareResult, blockchainResult, aiResult] = await Promise.allSettled([
    checkSupabase(),
    checkCloudflare(),
    checkBlockchain(),
    checkAIWorker(),
  ]);

  const supabase = supabaseResult.status === 'fulfilled' ? supabaseResult.value : { operational: false, latency: 'error' };
  const cloudflare = cloudflareResult.status === 'fulfilled' ? cloudflareResult.value : { operational: false, latency: 'error', configured: false };
  const blockchain = blockchainResult.status === 'fulfilled'
    ? blockchainResult.value
    : { operational: false, latency: 'error', chain: 'Polygon', blockNumber: null, configured: true };
  const ai = aiResult.status === 'fulfilled' ? aiResult.value : { operational: false, latency: 'error' };

  // Every `uptime` figure here used to be a literal — 99.99%, 99.98%, 100% —
  // and nothing in this codebase records availability over a window, so they
  // were decoration on the one page whose entire job is to be trusted during an
  // incident. A status page that cannot be wrong is worth nothing. Uptime is
  // reported as null until it is actually measured; the live probe result is
  // real and is what this endpoint now returns.
  const services = [
    {
      // This handler is served by the Core API, so a response at all is
      // evidence it is up — the latency is the real time spent in this request.
      name: 'Core Protocol API',
      status: 'Operational',
      uptime: null,
      latency: `${Date.now() - handlerStart}ms`,
    },
    {
      name: 'Edge Redirect Engine',
      status: cloudflare.configured ? (cloudflare.operational ? 'Operational' : 'Degraded') : 'Not configured',
      uptime: null,
      latency: cloudflare.latency,
    },
    {
      name: 'AI Generation Worker',
      status: ai.operational ? 'Operational' : 'Degraded',
      uptime: null,
      latency: ai.latency,
    },
    {
      name: 'Blockchain Anchoring (Polygon)',
      status: blockchain.configured ? (blockchain.operational ? 'Operational' : 'Degraded') : 'Not configured',
      uptime: null,
      latency: blockchain.latency,
      blockNumber: blockchain.blockNumber,
    },
    {
      name: 'Storage Cluster (S3/Supabase)',
      status: supabase.operational ? 'Operational' : 'Degraded',
      uptime: null,
      latency: supabase.latency,
    },
    {
      // Verification runs in the Core API process; it has no separate probe, so
      // it is reported as unmonitored rather than as a green light nobody checked.
      name: 'AuthiChain Verification',
      status: 'Not monitored',
      uptime: null,
      latency: null,
    },
  ];

  // Only core services affect overall status (exclude external infra like Blockchain/Edge)
  const coreDegraded = services
    .filter(s => !['Edge Redirect Engine', 'Blockchain Anchoring (Polygon)'].includes(s.name))
    .some(s => s.status === 'Degraded');

  const overallStatus = coreDegraded ? 'degraded' : 'operational';

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
  });
}
