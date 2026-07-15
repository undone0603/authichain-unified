'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ExternalLink, Loader2, RadioTower } from 'lucide-react';

interface Opportunity {
  notice_id: string;
  title: string;
  agency: string | null;
  deadline: string | null;
  naics_code: string | null;
  description: string | null;
  fit_score: number | null;
  sam_url: string | null;
  scored_at: string | null;
}

function fitColor(score: number | null): string {
  if (score === null) return '#71717a';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#71717a';
}

export function OpportunityRadar() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [q, setQ] = useState('');
  const [minFit, setMinFit] = useState(0);

  const load = useCallback(async (query: string, min: number) => {
    setLoading(true);
    setErrored(false);
    try {
      const params = new URLSearchParams({ limit: '20', min_fit: String(min) });
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/govchain/opportunities?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('request failed');
      const data = await res.json();
      setOpportunities(data.opportunities ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(q, minFit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, minFit), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, minFit]);

  return (
    <section className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
      <div className="flex items-center gap-2 mb-3">
        <RadioTower className="w-4 h-4 text-blue-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
          Live Opportunity Radar
        </p>
      </div>
      <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-3">
        Real SAM.gov opportunities, scored today.
      </h2>
      <p className="max-w-2xl text-zinc-400 text-sm mb-10">
        These are live results from our automated ingestion + AI scoring pipeline — updated on every run,
        no demo data. {total > 0 && `${total} opportunities currently in the radar.`}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search opportunity titles…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={minFit}
          onChange={(e) => setMinFit(Number(e.target.value))}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
        >
          <option value={0}>All fit scores</option>
          <option value={60}>Fit ≥ 60</option>
          <option value={80}>Fit ≥ 80</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading live opportunities…
        </div>
      )}

      {!loading && errored && (
        <p className="text-center py-16 text-zinc-500 text-sm">
          Couldn't load the live radar right now — try again shortly.
        </p>
      )}

      {!loading && !errored && opportunities.length === 0 && (
        <p className="text-center py-16 text-zinc-500 text-sm">
          No scored opportunities match right now — the pipeline ingests and scores on a daily schedule.
        </p>
      )}

      {!loading && !errored && opportunities.length > 0 && (
        <div className="grid gap-4">
          {opportunities.map((o) => (
            <article
              key={o.notice_id}
              className="protocol-card p-6 flex flex-col sm:flex-row sm:items-start gap-4"
            >
              <div
                className="shrink-0 flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 sm:w-20"
                style={{ color: fitColor(o.fit_score) }}
              >
                <span className="text-2xl font-black">{o.fit_score ?? '—'}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Fit Score
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-white mb-1.5 leading-snug">{o.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500 mb-2">
                  {o.agency && <span>{o.agency}</span>}
                  {o.naics_code && <span className="font-mono">NAICS {o.naics_code}</span>}
                  {o.deadline && <span>Due {o.deadline}</span>}
                </div>
                {o.description && (
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{o.description}</p>
                )}
              </div>
              {o.sam_url && (
                <a
                  href={o.sam_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 self-start inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
                >
                  View on SAM.gov <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
