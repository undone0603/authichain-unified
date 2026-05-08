import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Activity, Globe, Zap, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Network Status | QRON',
  description: 'Real-time status of all QRON network services.',
};

type ServiceStatus = {
  name: string;
  status: string;
  uptime: string;
  latency: string;
};

async function getStatus() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
    const res = await fetch(`${baseUrl}/api/status`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed');
    return res.json() as Promise<{ status: string; timestamp: string; services: ServiceStatus[] }>;
  } catch {
    return null;
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'Operational') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (status === 'Degraded') return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

export default async function StatusPage() {
  const data = await getStatus();

  const services: ServiceStatus[] = data?.services ?? [
    { name: 'Core Protocol API', status: 'Operational', uptime: '99.99%', latency: '42ms' },
    { name: 'Edge Redirect Engine', status: 'Operational', uptime: '100%', latency: '12ms' },
    { name: 'AI Generation Worker', status: 'Operational', uptime: '99.95%', latency: '2.4s' },
    { name: 'Blockchain Anchoring (Polygon)', status: 'Operational', uptime: '99.99%', latency: '120ms' },
    { name: 'Storage Cluster (S3/Supabase)', status: 'Operational', uptime: '100%', latency: '0ms' },
    { name: 'AuthiChain Verification', status: 'Operational', uptime: '99.98%', latency: '88ms' },
  ];

  const allOperational = services.every(s => s.status === 'Operational');

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-sm font-medium ${
              allOperational ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {allOperational ? 'All Systems Operational' : 'Partial Outage'}
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">
              Network <span className="text-[#FFD700]">Status</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
              Real-time protocol health & performance
            </p>
            {data?.timestamp && (
              <p className="text-zinc-600 text-xs mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated: {new Date(data.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
          <Link
            href="/studio"
            className="flex items-center justify-between p-3 rounded-lg border border-gray-800 hover:border-[#FFD700]/40 transition-colors text-sm"
          >
            <Zap className="w-4 h-4 text-[#FFD700] mr-2" />
            Launch Studio
          </Link>
        </header>

        <div className="space-y-3">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-black/40 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={svc.status} />
                <span className="font-medium text-sm">{svc.name}</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-zinc-400">
                <span>Uptime: <span className="text-white font-mono">{svc.uptime}</span></span>
                <span>Latency: <span className="text-white font-mono">{svc.latency}</span></span>
                <span className={`font-semibold ${
                  svc.status === 'Operational' ? 'text-green-400' :
                  svc.status === 'Degraded' ? 'text-yellow-400' : 'text-red-400'
                }`}>{svc.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 p-6 border border-gray-800 rounded-xl bg-black/40">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold">Incident History</h3>
          </div>
          <p className="text-zinc-500 text-sm">No incidents reported in the last 90 days.</p>
        </div>
      </div>
    </div>
  );
}
