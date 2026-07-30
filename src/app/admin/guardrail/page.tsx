'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Power, RefreshCw, ShieldAlert } from 'lucide-react';

interface ChannelStatus {
  name: string;
  category: string;
  enabled: boolean;
  dailyCap: number;
  usedToday: number;
  killSwitchEngaged: boolean;
  killSwitchReason: string | null;
}

interface GuardrailStatus {
  generated_at: string;
  global_kill_switch: { engaged: boolean; reason: string | null };
  channels: ChannelStatus[];
  suppression_list_size: number;
  recent_events: Array<{ channel_id: number | null; action: string; allowed: boolean | null; reason: string | null; at: string }>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function GuardrailDashboard() {
  const [data, setData] = useState<GuardrailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guardrail/status', { cache: 'no-store' });
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

  async function toggleKill(scope: string, enabled: boolean) {
    const reason = window.prompt(`Reason for ${enabled ? 'engaging' : 'releasing'} the kill switch on "${scope}"?`);
    if (!reason) return;
    await fetch('/api/guardrail/kill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope, enabled, reason }),
    });
    void load();
  }

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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-zinc-500 hover:text-gold text-xs font-bold uppercase tracking-widest mb-3">
              <ChevronLeft className="w-3 h-3" /> Admin
            </Link>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
              Guardrail <span className="gold-text">Console</span>
            </h1>
            <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest">
              refreshed {data ? formatTime(data.generated_at) : '—'} · suppression list: {data?.suppression_list_size ?? 0}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleKill('global', !(data?.global_kill_switch.engaged ?? false))}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded text-xs uppercase tracking-widest transition-colors ${
                data?.global_kill_switch.engaged ? 'border-red-500 text-red-400' : 'border-zinc-800 hover:border-red-500/40'
              }`}
            >
              <Power className="w-3 h-3" /> {data?.global_kill_switch.engaged ? 'Global: BLOCKED' : 'Global: Live'}
            </button>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 rounded text-xs uppercase tracking-widest hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </header>

        <section className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Channels</h2>
          <div className="protocol-card bg-zinc-950/50 border-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-3">Channel</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Today / Cap</th>
                  <th className="text-left px-4 py-3">Kill Switch</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.channels.length ? (
                  data.channels.map((ch) => (
                    <tr key={ch.name} className="border-t border-zinc-900/50">
                      <td className="px-4 py-3 font-mono text-xs">{ch.name}{!ch.enabled && <span className="text-zinc-600"> (disabled)</span>}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{ch.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{ch.usedToday} / {ch.dailyCap}</td>
                      <td className="px-4 py-3 text-xs">
                        {ch.killSwitchEngaged ? (
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <ShieldAlert className="w-3 h-3" /> {ch.killSwitchReason ?? 'engaged'}
                          </span>
                        ) : (
                          <span className="text-green-400">clear</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleKill(ch.name, !ch.killSwitchEngaged)}
                          className="px-3 py-1 border border-zinc-800 rounded text-[10px] uppercase tracking-widest hover:border-gold/40"
                        >
                          {ch.killSwitchEngaged ? 'Release' : 'Trip'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-700 text-xs uppercase tracking-widest">
                      No channels seeded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Recent Events</h2>
          <div className="protocol-card bg-zinc-950/50 border-zinc-900 divide-y divide-zinc-900/50">
            {data?.recent_events.length ? (
              data.recent_events.map((e, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${e.allowed === false ? 'bg-red-400' : 'bg-green-400'}`} />
                    <span className="font-mono text-xs">{e.action}</span>
                    <span className="text-[10px] text-zinc-600">{e.reason ?? ''}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600">{formatTime(e.at)}</span>
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
