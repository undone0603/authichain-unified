import { nextStage, scoreLead } from "./metrics";
import { SAM_OPPS } from "./sam-opps";
import {
  DOMAIN_META,
  ENGAGEMENT_BUMP,
  type Activity,
  type ActivityKind,
  type CaptureInput,
  type CycleReport,
  type HeartbeatEvent,
  type Lead,
} from "./types";

export function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function stamp(
  lead: Lead,
  kind: ActivityKind,
  detail: string,
  extra?: Partial<Lead>,
): Lead {
  const now = new Date().toISOString();
  const act: Activity = { id: nid("ac"), kind, timestamp: now, detail };
  const bump = ENGAGEMENT_BUMP[kind] ?? 0;
  const baseScore = extra?.score ?? lead.score;
  return {
    ...lead,
    ...extra,
    lastTouch: now,
    score: Math.min(99, baseScore + bump),
    activities: [act, ...(lead.activities ?? [])].slice(0, 40),
  };
}

export function applyCapture(
  leads: Lead[],
  input: CaptureInput,
): { leads: Lead[]; merged: boolean; lead: Lead } {
  const email = input.email.trim().toLowerCase();
  const existing = leads.find((l) => l.email.toLowerCase() === email);
  if (existing) {
    const note = input.notes.trim();
    const lead = stamp(
      existing,
      "capture",
      note ? `Re-captured: ${note}` : "Duplicate inbound — merged",
      { score: Math.min(99, existing.score + 6), draftPending: true, lost: false },
    );
    return {
      leads: leads.map((l) => (l.id === existing.id ? lead : l)),
      merged: true,
      lead,
    };
  }
  const score = scoreLead(input);
  const now = new Date().toISOString();
  const lead: Lead = {
    id: nid("ld"),
    name: input.name.trim(),
    title: input.title.trim() || "Contact",
    company: input.company.trim(),
    email,
    domain: input.domain,
    stage: score >= 70 ? "qualified" : "new",
    score,
    value: DOMAIN_META[input.domain].defaultValue,
    city: input.city.trim() || "—",
    notes: input.notes.trim() || "Captured from DreamDash.",
    lastTouch: now,
    createdAt: now,
    draftPending: score >= 50,
    source: "inbound",
    lost: false,
    activities: [
      {
        id: nid("ac"),
        kind: "capture",
        timestamp: now,
        detail: `Scored ${score}${score >= 70 ? " — auto-qualified" : ""}`,
      },
    ],
  };
  return { leads: [lead, ...leads], merged: false, lead };
}

export function applyCycle(
  leadsIn: Lead[],
  now = Date.now(),
): { leads: Lead[]; events: HeartbeatEvent[]; report: CycleReport } {
  const events: HeartbeatEvent[] = [];
  const push = (workflow: string, status: HeartbeatEvent["status"], detail: string) => {
    events.push({
      id: nid("ev"),
      workflow,
      status,
      timestamp: new Date(now).toISOString(),
      detail,
    });
  };

  let leads = leadsIn;
  let scored = 0;
  leads = leads.map((l) => {
    if (l.lost || l.stage === "converted") return l;
    scored += 1;
    return { ...l, score: Math.min(99, l.score + (l.draftPending ? 2 : 1)) };
  });
  push("dreamdash-lead-scoring", "ok", `Recalculated ${scored} scores.`);

  let nurtured = 0;
  leads = leads.map((l) => {
    if (!l.lost && l.stage === "new" && l.score >= 50) {
      nurtured += 1;
      return stamp(l, "nurture", "First-contact draft queued", {
        stage: "contacted",
        draftPending: true,
      });
    }
    return l;
  });
  push(
    "auto-nurture-drafts",
    nurtured ? "ok" : "skipped",
    nurtured
      ? `Drafted first contact for ${nurtured} lead${nurtured === 1 ? "" : "s"}.`
      : "No new leads ≥ 50.",
  );

  let advanced = 0;
  leads = leads.map((l) => {
    if (!l.lost && l.stage === "qualified" && l.score >= 85) {
      advanced += 1;
      return stamp(l, "advance", "High-score qualified → demoed", { stage: "demoed" });
    }
    return l;
  });
  push(
    "dreamdash-stage-advance",
    advanced ? "ok" : "skipped",
    advanced
      ? `Moved ${advanced} high-score qualified lead(s) to demoed.`
      : "No qualified leads ≥ 85.",
  );

  const stale = leads.filter((l) => {
    if (l.lost || l.stage !== "contacted") return false;
    return now - Date.parse(l.lastTouch) > 3 * 24 * 3600_000;
  });
  if (stale.length) {
    const ids = new Set(stale.map((s) => s.id));
    leads = leads.map((l) =>
      ids.has(l.id) ? stamp(l, "followup", "Stale 3-day follow-up queued") : l,
    );
  }
  push(
    "send-followups",
    stale.length ? "queued" : "skipped",
    stale.length
      ? `Follow-up queued for ${stale.map((s) => s.company).join(", ")}.`
      : "No contacted leads older than 3 days.",
  );

  const report: CycleReport = {
    at: new Date(now).toISOString(),
    scored,
    nurtured,
    advanced,
    followups: stale.length,
  };
  return { leads, events, report };
}

export function applyAdvance(lead: Lead): Lead | null {
  if (lead.lost) return null;
  const nxt = nextStage(lead.stage);
  if (!nxt) return null;
  return stamp(lead, "advance", `${lead.stage} → ${nxt}`, { stage: nxt });
}

export function applySamImport(leads: Lead[]): { leads: Lead[]; added: Lead[] } {
  const have = new Set(leads.map((l) => l.email.toLowerCase()));
  const fresh = SAM_OPPS.filter((o) => !have.has(o.email.toLowerCase()));
  const now = new Date().toISOString();
  const added: Lead[] = fresh.map((o) => {
    const score = Math.min(99, o.fit);
    return {
      id: nid("ld"),
      name: o.name,
      title: o.title,
      company: o.company,
      email: o.email.toLowerCase(),
      domain: "govchain",
      stage: score >= 70 ? "qualified" : "new",
      score,
      value: o.value,
      city: o.city,
      notes: o.notes,
      lastTouch: now,
      createdAt: now,
      draftPending: true,
      source: "sam",
      lost: false,
      activities: [
        {
          id: nid("ac"),
          kind: "capture",
          timestamp: now,
          detail: `SAM.gov import · fit ${o.fit}`,
        },
      ],
    };
  });
  return { leads: [...added, ...leads], added };
}
