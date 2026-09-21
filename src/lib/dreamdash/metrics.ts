import {
  DOMAINS,
  DOMAIN_META,
  STAGES,
  STALE_MS,
  STAGE_LABEL,
  type BoardSort,
  type Domain,
  type DomainFilter,
  type HeartbeatEvent,
  type Lead,
  type Stage,
  type StageFilter,
} from "./types";

const WEIGHT: Record<Stage, number> = {
  new: 0.05,
  contacted: 0.12,
  qualified: 0.25,
  demoed: 0.4,
  contracted: 0.7,
  signed: 0.9,
  converted: 1,
};

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1] ?? null;
}

export function scoreLead(input: {
  company: string;
  title: string;
  domain: Domain;
  notes?: string;
}): number {
  let score = 42;
  if (input.company.trim().length > 2) score += 12;
  const title = input.title.toLowerCase();
  if (/(founder|ceo|director|vp|head|chief|owner)/.test(title)) score += 18;
  if (/(compliance|procurement|authenticity|brand protection)/.test(title)) score += 10;
  if (input.domain === "govchain") score += 6;
  if (input.domain === "authichain") score += 4;
  if ((input.notes ?? "").length > 40) score += 8;
  return Math.min(99, score);
}

export function isOpen(lead: Lead) {
  return !lead.lost && lead.stage !== "converted";
}

export function filterLeads(
  leads: Lead[],
  domain: DomainFilter,
  stage: StageFilter,
): Lead[] {
  return leads.filter((l) => {
    if (domain !== "all" && l.domain !== domain) return false;
    if (stage !== "all" && l.stage !== stage) return false;
    return true;
  });
}

export function isStale(lead: Lead, now = Date.now()) {
  if (lead.lost || lead.stage === "converted" || lead.stage === "signed") return false;
  return now - Date.parse(lead.lastTouch) > STALE_MS;
}

export function daysStale(lead: Lead, now = Date.now()) {
  return Math.max(1, Math.round((now - Date.parse(lead.lastTouch)) / (24 * 3600_000)));
}

export function staleLeads(leads: Lead[], now = Date.now()) {
  return [...leads]
    .filter((l) => isStale(l, now))
    .sort((a, b) => Date.parse(a.lastTouch) - Date.parse(b.lastTouch));
}

export function nextAction(lead: Lead): string {
  if (lead.lost) return "Reopen or archive";
  if (lead.stage === "converted") return "Fulfilled — no action";
  if (lead.stage === "signed") return "Kick off first seals";
  if (lead.draftPending) return "Send the queued draft";
  if (lead.stage === "new") return "First contact";
  if (lead.stage === "contacted" && isStale(lead)) return "Stale follow-up";
  if (lead.stage === "contacted") return "Qualify or book the demo";
  if (lead.stage === "qualified" && lead.score >= 85) return "Advance to demoed";
  if (lead.stage === "qualified") return "Walk a 14-day pilot";
  if (lead.stage === "demoed") return "Send contract paper";
  if (lead.stage === "contracted") return "Protect countersign";
  return "Log a touch";
}

export function closePriority(lead: Lead) {
  let p = lead.score;
  if (lead.draftPending) p += 18;
  if (isStale(lead)) p += 14;
  if (lead.stage === "signed") p += 28;
  if (lead.stage === "contracted") p += 24;
  if (lead.stage === "demoed") p += 12;
  if (lead.stage === "qualified") p += 6;
  return p;
}

export function closeOrder(leads: Lead[], limit = 3) {
  return [...leads]
    .filter(isOpen)
    .sort((a, b) => closePriority(b) - closePriority(a) || b.value - a.value)
    .slice(0, limit);
}

export function searchLeads(leads: Lead[], q: string) {
  const n = q.trim().toLowerCase();
  if (!n) return leads;
  return leads.filter((l) =>
    [l.company, l.name, l.email, l.city, l.notes, l.title, l.domain].some((s) =>
      s.toLowerCase().includes(n),
    ),
  );
}

export function sortLeads(leads: Lead[], sort: BoardSort) {
  const copy = [...leads];
  const rank = (a: Lead, b: Lead, n: number) => Number(Boolean(a.lost)) - Number(Boolean(b.lost)) || n;
  if (sort === "value") return copy.sort((a, b) => rank(a, b, b.value - a.value));
  if (sort === "touch") return copy.sort((a, b) => rank(a, b, Date.parse(b.lastTouch) - Date.parse(a.lastTouch)));
  if (sort === "stale") return copy.sort((a, b) => rank(a, b, Date.parse(a.lastTouch) - Date.parse(b.lastTouch)));
  return copy.sort((a, b) => rank(a, b, b.score - a.score));
}

export function stageValue(leads: Lead[]) {
  const raw = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const l of leads) {
    if (l.lost) continue;
    raw[l.stage] += l.value;
  }
  return raw;
}

export function computeDashboard(leads: Lead[], events: HeartbeatEvent[]) {
  const open = leads.filter((l) => !l.lost);
  const pipeline = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const l of open) pipeline[l.stage] += 1;
  const converted = open.filter((l) => l.stage === "converted");
  const closedRevenue = converted.reduce((a, l) => a + l.value, 0);
  const weightedPipeline = open
    .filter((l) => l.stage !== "converted")
    .reduce((a, l) => a + l.value * WEIGHT[l.stage], 0);
  const now = Date.now();
  const day = 24 * 3600_000;
  const leads7d = leads.filter((l) => now - Date.parse(l.createdAt) < 7 * day).length;
  const events24h = events.filter((e) => now - Date.parse(e.timestamp) < day);
  const draftsPending = open.filter((l) => l.draftPending).length;
  const stale = staleLeads(open, now);
  const lostCount = leads.filter((l) => l.lost).length;
  const sentFromLeads = leads.reduce((n, l) => {
    return n + (l.activities ?? []).filter((a) => a.kind === "sent" && now - Date.parse(a.timestamp) < day).length;
  }, 0);
  const sentFromEvents = events24h.filter((e) => e.workflow.includes("nurture") || e.workflow.includes("follow")).length;
  const workflowBreakdown: Record<string, number> = {};
  for (const e of events24h) workflowBreakdown[e.workflow] = (workflowBreakdown[e.workflow] ?? 0) + 1;
  const domainMetrics = DOMAINS.map((domain) => {
    const rows = open.filter((l) => l.domain === domain);
    const conv = rows.filter((l) => l.stage === "converted").length;
    const avg = rows.length === 0 ? 0 : rows.reduce((a, l) => a + l.score, 0) / rows.length;
    const value = rows.reduce((a, l) => a + l.value, 0);
    return { domain, ...DOMAIN_META[domain], total: rows.length, converted: conv, conversionRate: rows.length ? (conv / rows.length) * 100 : 0, avgScore: avg, value };
  });
  const hot = [...open].filter((l) => l.stage !== "converted" && l.score >= 70).sort((a, b) => b.score - a.score).slice(0, 5);
  const avgScore = open.length === 0 ? 0 : open.reduce((a, l) => a + l.score, 0) / open.length;
  const conversionRate = open.length ? (converted.length / open.length) * 100 : 0;
  return {
    pipeline,
    stageValue: stageValue(open),
    total: open.length,
    closed: converted.length,
    conversionRate,
    closedRevenue,
    weightedPipeline,
    avgScore,
    leads7d,
    draftsPending,
    emailsSent24h: sentFromLeads + sentFromEvents,
    actions24h: events24h.length,
    workflowBreakdown,
    domainMetrics,
    hot,
    stale,
    staleCount: stale.length,
    lostCount,
    finalStage: pipeline.contracted + pipeline.signed,
    order: closeOrder(open),
  };
}

export function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

export function compileDigest(leads: Lead[], events: HeartbeatEvent[]) {
  const dash = computeDashboard(leads, events);
  const hot = dash.hot.map((l) => `${l.company} ${l.score}`).join(", ") || "none";
  const stale = dash.stale.slice(0, 5).map((l) => `${l.company} (${daysStale(l)}d, ${STAGE_LABEL[l.stage]})`).join(", ") || "none";
  const drafts = leads.filter((l) => l.draftPending && !l.lost).map((l) => l.company).join(", ") || "none";
  const order = dash.order.map((l, i) => `${i + 1}. ${l.company} — ${nextAction(l)}`).join("\n") || "none";
  const day = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `Founders digest — ${day}\n\nEstate: ${dash.total} leads · ${dash.closed} closed · ${pct(dash.conversionRate)} conversion\nClosed revenue ${money(dash.closedRevenue)} · Weighted pipe ${money(dash.weightedPipeline)} · Avg score ${dash.avgScore.toFixed(1)}\n\nClose order:\n${order}\n\nHot closes: ${hot}\nNeeds follow-up: ${stale}\nDrafts pending: ${drafts}\nEmails / 24h: ${dash.emailsSent24h} · Actions / 24h: ${dash.actions24h}\n\nClose order: advance only on a logged action. Zero paid channels.`;
}

export function draftFor(lead: Lead) {
  const first = lead.name.split(" ")[0] || lead.name || "there";
  const lines: Record<Domain, string> = {
    authichain: `Subject: American Seal — authenticate ${lead.company} goods in under 2s\n\n${first} —\n\nAuthiChain issues Ed25519-signed seals on Polygon so a customer can prove a product is real in about 2.1 seconds. We are running founder-led pilots for luxury, medical, and packaging lines at ~$0.004/seal.\n\nHappy to walk ${lead.company} through a 14-day American Seal pilot (single SKU, public verify page, chain-of-custody log).`,
    qron: `Subject: Living QR codes for ${lead.company}\n\n${first} —\n\nQRON turns a scannable code into artwork with an on-chain certificate. Collectors dwell ~3.5 minutes; scan rates run ~78% above static QR.\n\nThe QRON Card / pack path starts at $299. I can generate a signed sample against ${lead.company}'s URL this week.`,
    strainchain: `Subject: METRC-aligned provenance for ${lead.company}\n\n${first} —\n\nStrainChain anchors seed-to-sale lots on-chain and issues scannable seals that sit beside METRC — anti-diversion without replacing the state system. Michigan MSO pilots are open.\n\nI can demo a lot seal + dispensary verify flow for ${lead.company} on a 20-minute call.`,
    govchain: `Subject: Public verification for ${lead.company} credentials\n\n${first} —\n\nGovChain authenticates licenses, deeds, and procurement records with originals on-prem and a public <2s verify. Built toward NIST 800-53 / FedRAMP-ready controls.\n\nI can map ${lead.company}'s highest-risk document type to a TruMark seal and a public verify page.`,
  };
  return lines[lead.domain];
}

export function mailtoFor(lead: Lead) {
  const draft = draftFor(lead);
  const nl = draft.indexOf("\n");
  const subjectLine = (nl === -1 ? draft : draft.slice(0, nl)).replace(/^Subject:\s*/i, "");
  const body = nl === -1 ? "" : draft.slice(nl + 1).trim();
  return `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
}
