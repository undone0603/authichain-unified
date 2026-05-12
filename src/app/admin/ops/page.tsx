'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';

interface OpsData {
  window_hours: number;
  generated_at: string;
  totals: { success: number; failure: number };
  summary: Array<{
    workflow: string;
    success: number;
    failure: number;
    last_seen: string;
    last_error: string | null;
  }>;
  failures: Array<{ workflow: string; error: string | null; payload: string | null; at: string }>;
  recent: Array<{ workflow: string; status: string; at: string }>;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OpsDashboard() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ops', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-red-400 font-mono text-sm">Error: {error}</p>
          <button onClick={() => void load()} className="mt-4 px-4 py-2 border border-zinc-800 rounded text-xs uppercase tracking-widest">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalEvents = (data?.totals.success ?? 0) + (data?.totals.failure ?? 0);
  const successRate = totalEvents > 0 ? ((data!.totals.success / totalEvents) * 100).toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-zinc-500 hover:text-gold text-xs font-bold uppercase tracking-widest mb-3">
              <ChevronLeft className="w-3 h-3" /> Admin
            </Link>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
              Operations <span className="gold-text">Console</span>
            </h1>
            <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest">
              Last {data?.window_hours}h · refreshed {data ? formatTime(data.generated_at) : '—'}
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded text-xs uppercase tracking-widest hover:border-gold/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="protocol-card p-6 bg-zinc-950/50 border-zinc-900">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Successes</span>
            </div>
            <p className="text-3xl font-black text-green-400">{data?.totals.success ?? 0}</p>
          </div>
          <div className="protocol-card p-6 bg-zinc-950/50 border-zinc-900">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Failures</span>
            </div>
            <p className="text-3xl font-black text-red-400">{data?.totals.failure ?? 0}</p>
          </div>
          <div className="protocol-card p-6 bg-zinc-950/50 border-zinc-900">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-gold" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Success Rate</span>
            </div>
            <p className="text-3xl font-black text-gold">{successRate}%</p>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Workflow Summary</h2>
          <div className="protocol-card bg-zinc-950/50 border-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3">Workflow</th>
                  <th className="text-right px-4 py-3">Success</th>
                  <th className="text-right px-4 py-3">Failure</th>
                  <th className="text-left px-4 py-3">Last Error</th>
                  <th className="text-right px-4 py-3">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {data?.summary.length ? (
                  data.summary.map((row) => (
                    <tr key={row.workflow} className="border-t border-zinc-900/50">
                      <td className="px-4 py-3 font-mono text-xs">{row.workflow}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-bold tabular-nums">{row.success}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${row.failure > 0 ? 'text-red-400' : 'text-zinc-700'}`}>
                        {row.failure}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-md truncate" title={row.last_error ?? ''}>
                        {row.last_error ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[10px] text-zinc-600 whitespace-nowrap">
                        {formatTime(row.last_seen)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-700 text-xs uppercase tracking-widest">
                      No events in last 24h
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {data?.failures.length ? (
          <section className="mb-12">
            <h2 className="text-sm font-black uppercase tracking-widest text-red-400 mb-4">
              Recent Failures ({data.failures.length})
            </h2>
            <div className="space-y-3">
              {data.failures.map((f, i) => (
                <div key={i} className="protocol-card p-4 bg-red-950/10 border-red-900/30">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <span className="font-mono text-xs text-red-300">{f.workflow}</span>
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">{formatTime(f.at)}</span>
                  </div>
                  <pre className="text-[11px] text-zinc-400 font-mono whitespace-pre-wrap break-words">
                    {f.error || '(no error message)'}
                  </pre>
                  {f.payload && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">payload</summary>
                      <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words mt-1">
                        {f.payload}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-12">
            <div className="protocol-card p-8 bg-green-950/10 border-green-900/30 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <p className="text-green-300 font-bold uppercase tracking-widest text-sm">All Operational</p>
              <p className="text-zinc-500 text-xs mt-1">No failures in the last 24h</p>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Recent Events</h2>
          <div className="protocol-card bg-zinc-950/50 border-zinc-900 divide-y divide-zinc-900/50">
            {data?.recent.length ? (
              data.recent.map((r, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="font-mono text-xs">{r.workflow}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600">{formatTime(r.at)}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-12 text-center text-zinc-700 text-xs uppercase tracking-widest">
                No recent events
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
