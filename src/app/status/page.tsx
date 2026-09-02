  import { Activity,AlertTriangle,CheckCircle2,Clock,XCircle,Zap } from 'lucide-react';
  import type { Metadata } from 'next';
  import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Network Status | QRON',
  description: 'Real-time status of all QRON network services.',
};

type ServiceStatus = {
  name: string;
  status: string;
  // Null until availability is actually recorded over a window. Nothing in this
  // codebase measures uptime yet, so the page renders a dash rather than a
  // number that would only ever be decoration.
  uptime: string | null;
  latency: string | null;
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
  // A service nobody probes is unknown, not down — and not green either.
  if (status === 'Not monitored' || status === 'Not configured') return <Clock className="w-4 h-4 text-zinc-500" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

export default async function StatusPage() {
  const data = await getStatus();

  // When /api/status cannot be reached, that is itself the most likely moment
  // for something to be wrong. This used to fall back to a hardcoded all-green
  // board reporting 99.99% uptime — the page would look healthiest exactly when
  // it had the least idea. An unreachable status API now reads as unknown.
  const services: ServiceStatus[] = data?.services ?? [];
  const reachable = services.length > 0;

  const allOperational = reachable && services.every(s => s.status === 'Operational' || s.status === 'Not monitored');

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-sm font-medium ${
              !reachable ? 'bg-zinc-500/10 text-zinc-400'
                : allOperational ? 'bg-green-500/10 text-green-400'
                : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              {!reachable ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {!reachable ? 'Status Unavailable' : allOperational ? 'All Systems Operational' : 'Partial Outage'}
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
          {!reachable && (
            <div className="p-6 rounded-xl border border-gray-800 bg-black/40 text-sm text-zinc-400">
              The status API could not be reached, so live service health is unknown right now.
              This page does not guess — retry in a moment.
            </div>
          )}
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
                <span>Uptime: <span className="text-zinc-600 font-mono">{svc.uptime ?? '—'}</span></span>
                <span>Latency: <span className="text-white font-mono">{svc.latency ?? '—'}</span></span>
                <span className={`font-semibold ${
                  svc.status === 'Operational' ? 'text-green-400' :
                  svc.status === 'Degraded' ? 'text-yellow-400' :
                  svc.status === 'Not monitored' || svc.status === 'Not configured' ? 'text-zinc-500' :
                  'text-red-400'
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
          {/* "No incidents in the last 90 days" was asserted by a page with no
              incident tracking of any kind, so it could never have said anything
              else. */}
          <p className="text-zinc-500 text-sm">
            Incident history is not published yet. This page reports live probe results only.
          </p>
        </div>
      </div>
    </div>
  );
}
