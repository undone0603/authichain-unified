import { useEffect, useState } from 'react';
import { Link } from 'wouter';
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-destructive font-mono text-sm">Error: {error}</p>
          <button onClick={() => void load()} className="mt-4 px-4 py-2 border rounded text-xs uppercase tracking-widest">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalEvents = (data?.totals.success ?? 0) + (data?.totals.failure ?? 0);
  const successRate = totalEvents > 0 ? ((data!.totals.success / totalEvents) * 100).toFixed(1) : '—';

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary text-xs font-bold uppercase tracking-widest mb-3 cursor-pointer">
            <ChevronLeft className="w-3 h-3" /> Admin
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Operations <span className="text-primary">Console</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm uppercase tracking-widest">
            Last {data?.window_hours}h · refreshed {data ? formatTime(data.generated_at) : '—'}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded text-xs uppercase tracking-widest hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Successes</span>
          </div>
          <p className="text-3xl font-black text-green-500">{data?.totals.success ?? 0}</p>
        </div>
        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Failures</span>
          </div>
          <p className="text-3xl font-black text-destructive">{data?.totals.failure ?? 0}</p>
        </div>
        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Success Rate</span>
          </div>
          <p className="text-3xl font-black text-primary">{successRate}%</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Workflow Summary</h2>
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
                  <tr key={row.workflow} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{row.workflow}</td>
                    <td className="px-4 py-3 text-right text-green-500 font-bold tabular-nums">{row.success}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${row.failure > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {row.failure}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate" title={row.last_error ?? ''}>
                      {row.last_error ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatTime(row.last_seen)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-xs uppercase tracking-widest">
                    No events in last 24h
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data?.failures.length ? (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-destructive mb-4">
            Recent Failures ({data.failures.length})
          </h2>
          <div className="space-y-3">
            {data.failures.map((f, i) => (
              <div key={i} className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <span className="font-mono text-xs text-destructive">{f.workflow}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(f.at)}</span>
                </div>
                <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words">
                  {f.error || '(no error message)'}
                </pre>
                {f.payload && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary">payload</summary>
                    <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-words mt-1">
                      {f.payload}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="p-8 rounded-lg border border-green-500/30 bg-green-500/5 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <p className="text-green-500 font-bold uppercase tracking-widest text-sm">All Operational</p>
            <p className="text-muted-foreground text-xs mt-1">No failures in the last 24h</p>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Recent Events</h2>
        <div className="rounded-lg border bg-card divide-y">
          {data?.recent.length ? (
            data.recent.map((r, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'success' ? 'bg-green-500' : 'bg-destructive'}`} />
                  <span className="font-mono text-xs">{r.workflow}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatTime(r.at)}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-muted-foreground text-xs uppercase tracking-widest">
              No recent events
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
