"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CLOSER_HELLO, closerReply } from "@/lib/dreamdash/closer-kb";
import {
  compileDigest,
  computeDashboard,
  daysStale,
  filterLeads,
  mailtoFor,
  money,
  nextAction,
  pct,
  searchLeads,
} from "@/lib/dreamdash/metrics";
import {
  DOMAINS,
  DOMAIN_META,
  DOMAIN_TICK,
  STAGE_BAR,
  STAGE_LABEL,
  STAGES,
  type ActivityKind,
  type CycleReport,
  type DashView,
  type Domain,
  type DomainFilter,
  type HeartbeatEvent,
  type Lead,
  type StageFilter,
} from "@/lib/dreamdash/types";

type Dash = ReturnType<typeof computeDashboard>;

export function FoundersCommand() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<HeartbeatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<DashView>("today");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [lastCycle, setLastCycle] = useState<CycleReport | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/founders/dashboard");
    if (res.status === 401) {
      window.location.href = "/login?next=/founders";
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load");
    setLeads(data.leads ?? []);
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  async function mutate(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/founders/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      if (!res.ok) throw new Error("Mutation failed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runCycle() {
    setBusy(true);
    try {
      const res = await fetch("/api/founders/cycle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cycle failed");
      setLastCycle(data.report);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function capture(form: FormData) {
    setBusy(true);
    try {
      const payload = {
        name: String(form.get("name") || ""),
        title: String(form.get("title") || ""),
        company: String(form.get("company") || ""),
        email: String(form.get("email") || ""),
        domain: String(form.get("domain") || "authichain") as Domain,
        city: String(form.get("city") || ""),
        notes: String(form.get("notes") || ""),
      };
      const res = await fetch("/api/founders/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capture: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Capture failed");
      setCaptureOpen(false);
      setSelectedId(data.lead?.id ?? null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function importSam() {
    setBusy(true);
    try {
      await fetch("/api/founders/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-sam" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (captureOpen || digestOpen || selectedId) return;
      if (e.key === "c") { e.preventDefault(); setCaptureOpen(true); }
      else if (e.key === "r") { e.preventDefault(); void runCycle(); }
      else if (e.key === "1") setView("today");
      else if (e.key === "2") setView("board");
      else if (e.key === "3") setView("ops");
      else if (e.key === "/") {
        e.preventDefault();
        setView("board");
        window.setTimeout(() => document.getElementById("pipeline-search")?.focus(), 30);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureOpen, digestOpen, selectedId]);

  const scoped = useMemo(() => filterLeads(leads, domainFilter, "all"), [leads, domainFilter]);
  const dash = useMemo(() => computeDashboard(scoped, events), [scoped, events]);
  const visible = useMemo(() => searchLeads(filterLeads(leads, domainFilter, stageFilter), query), [leads, domainFilter, stageFilter, query]);
  const selected = leads.find((l) => l.id === selectedId) ?? null;

  if (loading) return <div className="min-h-screen bg-[#0c0c0d] text-[#d4b45a] flex items-center justify-center text-xs uppercase tracking-[0.22em]">Loading DreamDash</div>;
  if (error) return <div className="min-h-screen bg-[#0c0c0d] text-red-400 flex items-center justify-center text-sm">{error}</div>;

  return (
    <div className="min-h-screen bg-[#0c0c0d] text-[#f2efe8]">
      <header className="sticky top-0 z-30 border-b border-[#b8b4aa]/20 bg-[#0c0c0d]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.22em] text-[#d4b45a]">Founders DreamDash</p>
            <h1 className="truncate text-xl">Deal Command</h1>
          </div>
          <button type="button" className="h-11 rounded-full bg-[#141416] px-4 text-sm" onClick={() => setCaptureOpen(true)}>Capture</button>
          <button type="button" className="h-11 rounded-full bg-[#d4b45a] px-4 text-sm text-[#0c0c0d]" disabled={busy} onClick={() => void runCycle()}>Run cycle</button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          {(["today", "board", "ops"] as DashView[]).map((id) => (
            <button key={id} type="button" onClick={() => setView(id)} className={`h-11 rounded-full px-3.5 text-sm capitalize ${view === id ? "bg-[#d4b45a] text-[#0c0c0d]" : "text-[#b8b4aa]"}`}>{id}</button>
          ))}
          {(["all", ...DOMAINS] as DomainFilter[]).map((d) => (
            <button key={d} type="button" onClick={() => setDomainFilter(d)} className={`flex h-11 items-center gap-2 rounded-full px-3 text-sm ${domainFilter === d ? "bg-[#f2efe8] text-[#0c0c0d]" : "text-[#b8b4aa]"}`}>
              {d !== "all" ? <span className={`size-1.5 rounded-full ${DOMAIN_TICK[d]}`} /> : null}
              {d === "all" ? "Estate" : DOMAIN_META[d].label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {lastCycle ? <p className="rounded-xl bg-[#141416] px-4 py-3 text-sm text-[#b8b4aa]"><span className="text-[#d4b45a]">Cycle </span>scored {lastCycle.scored} · {lastCycle.nurtured} nurtured · {lastCycle.advanced} advanced · {lastCycle.followups} follow-ups</p> : null}
        {view === "today" ? (
          <>
            <h2 className="text-xs uppercase tracking-[0.22em] text-[#d4b45a]">Close order</h2>
            {dash.order.length === 0 ? <p className="text-sm text-[#b8b4aa]">Nothing open to close. Capture a lead.</p> : dash.order.map((l, i) => (
              <article key={l.id} className="rounded-xl bg-[#141416] p-4">
                <button type="button" className="text-left" onClick={() => setSelectedId(l.id)}>
                  <p className="text-xs text-[#d4b45a]">{i + 1}. {l.company}</p>
                  <p className="text-sm text-[#b8b4aa]">{nextAction(l)}</p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="rounded-full bg-[#d4b45a] px-3 py-2 text-xs text-[#0c0c0d]" onClick={() => void mutate(l.id, "advance")}>Advance</button>
                  <button type="button" className="rounded-full bg-[#0c0c0d] px-3 py-2 text-xs" onClick={() => void mutate(l.id, "send")}>Send draft</button>
                  <button type="button" className="rounded-full bg-[#0c0c0d] px-3 py-2 text-xs" onClick={() => { setSelectedId(l.id); void mutate(l.id, "followup"); }}>Queue + Open</button>
                </div>
              </article>
            ))}
            <Kpis dash={dash} compact />
            <Rail title="Hot" rows={dash.hot} onSelect={setSelectedId} />
            <Rail title="Stale (3-day)" rows={dash.stale} onSelect={setSelectedId} stale />
          </>
        ) : null}
        {view === "board" ? <BoardView dash={dash} visible={visible} query={query} setQuery={setQuery} stageFilter={stageFilter} setStageFilter={setStageFilter} selectedId={selectedId} onSelect={setSelectedId} onAdvance={(id) => void mutate(id, "advance")} /> : null}
        {view === "ops" ? <OpsView dash={dash} events={events} leads={leads} onDigest={() => setDigestOpen(true)} onImport={() => void importSam()} /> : null}
        <p className="pb-8 text-xs text-[#b8b4aa]/70">Empty pipeline is valid. Capture is the path. <Link href="/admin/leads" className="text-[#d4b45a]">/admin/leads</Link> · c capture · r cycle · 1–3 views · / search</p>
      </main>
      {selected ? <Sheet lead={selected} onClose={() => setSelectedId(null)} onAction={(action, extra) => void mutate(selected.id, action, extra)} /> : null}
      {captureOpen ? <Capture busy={busy} onClose={() => setCaptureOpen(false)} onSubmit={capture} /> : null}
      {digestOpen ? (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setDigestOpen(false)}>
          <pre className="absolute left-1/2 top-1/2 max-h-[80vh] w-[min(92vw,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#141416] p-6 text-sm" onClick={(e) => e.stopPropagation()}>{compileDigest(leads, events)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function BoardView({ dash, visible, query, setQuery, stageFilter, setStageFilter, selectedId, onSelect, onAdvance }: { dash: Dash; visible: Lead[]; query: string; setQuery: (v: string) => void; stageFilter: StageFilter; setStageFilter: (v: StageFilter) => void; selectedId: string | null; onSelect: (id: string) => void; onAdvance: (id: string) => void }) {
  const max = Math.max(...Object.values(dash.pipeline), 1);
  return (
    <>
      <Kpis dash={dash} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {STAGES.map((stage) => (
            <button key={stage} type="button" onClick={() => setStageFilter(stageFilter === stage ? "all" : stage)} className="block w-full text-left">
              <div className="mb-1 flex justify-between text-xs"><span>{STAGE_LABEL[stage]}</span><span>{dash.pipeline[stage]} · {money(dash.stageValue[stage])}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#141416]"><div className={`h-full ${STAGE_BAR[stage]}`} style={{ width: `${(dash.pipeline[stage] / max) * 100}%` }} /></div>
            </button>
          ))}
        </div>
        <div className="space-y-2 lg:col-span-2">
          {dash.domainMetrics.map((row) => (
            <div key={row.domain} className="rounded-xl bg-[#141416] p-3">
              <div className="flex items-center gap-2 text-sm"><span className={`size-1.5 rounded-full ${DOMAIN_TICK[row.domain]}`} />{row.label}</div>
              <p className="text-xs text-[#b8b4aa]">{row.total} leads · {pct(row.conversionRate)} · {money(row.value)}</p>
            </div>
          ))}
        </div>
      </div>
      <input id="pipeline-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search board" className="h-11 w-full rounded-xl bg-[#141416] px-4 text-sm outline-none" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-xl bg-[#141416] p-2">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-[#b8b4aa]">{STAGE_LABEL[stage]}</p>
            {visible.filter((l) => l.stage === stage && !l.lost).map((l) => (
              <div key={l.id} className={`mb-2 rounded-lg p-2 ${selectedId === l.id ? "bg-[#d4b45a]/15" : "bg-[#0c0c0d]"}`}>
                <button type="button" className="text-left text-xs" onClick={() => onSelect(l.id)}>{l.company}</button>
                <button type="button" className="mt-1 block text-[10px] text-[#d4b45a]" onClick={() => onAdvance(l.id)}>Advance</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function OpsView({ dash, events, leads, onDigest, onImport }: { dash: Dash; events: HeartbeatEvent[]; leads: Lead[]; onDigest: () => void; onImport: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(CLOSER_HELLO);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-11 rounded-full bg-[#d4b45a] px-4 text-sm text-[#0c0c0d]" onClick={onImport}>Import SAM.gov catalog</button>
        <button type="button" className="h-11 rounded-full bg-[#141416] px-4 text-sm" onClick={onDigest}>Compile digest</button>
      </div>
      <p className="text-sm text-[#b8b4aa]">{dash.total} open · {dash.draftsPending} drafts · {dash.staleCount} stale · {dash.actions24h} actions / 24h</p>
      {events.slice(0, 8).map((e) => <p key={e.id} className="text-xs text-[#b8b4aa]">{e.workflow} · {e.status}</p>)}
      <section className="rounded-xl bg-[#141416] p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-[#d4b45a]">AgentZ closer</p>
        <p className="mb-3 text-sm">{reply}</p>
        <form onSubmit={(e) => { e.preventDefault(); setReply(closerReply(prompt, leads)); setPrompt(""); }}>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask pricing, pilot, or name a company" className="h-11 w-full rounded-xl bg-[#0c0c0d] px-4 text-sm outline-none" />
        </form>
      </section>
    </>
  );
}

function Kpis({ dash, compact }: { dash: Dash; compact?: boolean }) {
  const items = compact
    ? [["Open", String(dash.total)], ["Closed", String(dash.closed)], ["Pipe", money(dash.weightedPipeline)]]
    : [["Open", String(dash.total)], ["Closed", String(dash.closed)], ["Conversion", pct(dash.conversionRate)], ["Weighted", money(dash.weightedPipeline)], ["Avg score", dash.avgScore.toFixed(1)]];
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 md:grid-cols-5"}`}>
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-[#141416] p-4">
          <p className="text-[10px] uppercase tracking-widest text-[#b8b4aa]">{label}</p>
          <p className="text-xl">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Rail({ title, rows, onSelect, stale }: { title: string; rows: Lead[]; onSelect: (id: string) => void; stale?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-[0.22em] text-[#d4b45a]">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-[#b8b4aa]">None.</p> : rows.slice(0, 6).map((l) => (
        <button key={l.id} type="button" className="mb-2 block w-full rounded-xl bg-[#141416] p-3 text-left" onClick={() => onSelect(l.id)}>
          <p className="text-sm">{l.company}</p>
          <p className="text-xs text-[#b8b4aa]">{l.score}{stale ? ` · ${daysStale(l)}d` : ""}</p>
        </button>
      ))}
    </section>
  );
}

function Sheet({ lead, onClose, onAction }: { lead: Lead; onClose: () => void; onAction: (action: string, extra?: Record<string, unknown>) => void }) {
  const [notes, setNotes] = useState(lead.notes);
  useEffect(() => setNotes(lead.notes), [lead.id, lead.notes]);
  return (
    <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-[#141416] p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs uppercase tracking-[0.22em] text-[#d4b45a]">{lead.domain}</p>
        <h2 className="mt-1 text-2xl">{lead.company}</h2>
        <p className="text-sm text-[#b8b4aa]">{lead.name} · {lead.title} · {STAGE_LABEL[lead.stage]} · {lead.score}</p>
        <p className="mt-3 text-sm">{nextAction(lead)}</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onAction("notes", { notes })} className="mt-4 h-28 w-full rounded-xl bg-[#0c0c0d] p-3 text-sm" />
        <div className="mt-4 flex flex-wrap gap-2">
          {(["opened", "clicked", "demo"] as ActivityKind[]).map((kind) => (
            <button key={kind} type="button" className="rounded-full bg-[#0c0c0d] px-3 py-2 text-xs capitalize" onClick={() => onAction("activity", { kind, detail: kind })}>{kind}</button>
          ))}
          <a href={mailtoFor(lead)} className="rounded-full bg-[#d4b45a] px-3 py-2 text-xs text-[#0c0c0d]">Send email</a>
          {lead.lost ? <button type="button" className="rounded-full bg-[#0c0c0d] px-3 py-2 text-xs" onClick={() => onAction("reopen")}>Reopen</button> : <button type="button" className="rounded-full bg-[#0c0c0d] px-3 py-2 text-xs" onClick={() => onAction("lost")}>Mark lost</button>}
        </div>
      </aside>
    </div>
  );
}

function Capture({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (form: FormData) => Promise<void> }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose}>
      <form className="absolute left-1/2 top-1/2 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-2xl bg-[#141416] p-6" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void onSubmit(new FormData(e.currentTarget)); }}>
        <h2 className="text-lg">Capture lead</h2>
        {["name", "title", "company", "email", "city"].map((field) => (
          <input key={field} name={field} required={field === "company" || field === "email"} placeholder={field} className="h-11 w-full rounded-xl bg-[#0c0c0d] px-3 text-sm" />
        ))}
        <select name="domain" className="h-11 w-full rounded-xl bg-[#0c0c0d] px-3 text-sm" defaultValue="authichain">
          {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_META[d].label}</option>)}
        </select>
        <textarea name="notes" placeholder="notes" className="h-20 w-full rounded-xl bg-[#0c0c0d] p-3 text-sm" />
        <button type="submit" disabled={busy} className="h-11 w-full rounded-full bg-[#d4b45a] text-sm text-[#0c0c0d]">Save</button>
      </form>
    </div>
  );
}
