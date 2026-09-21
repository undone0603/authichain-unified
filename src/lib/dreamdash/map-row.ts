import { DOMAINS, DOMAIN_META, STAGES, type Domain, type Lead, type LeadMeta, type Stage } from "./types";

export interface LeadCaptureRow {
  id: string;
  email: string;
  name?: string | null;
  source?: string | null;
  product_interest?: string | null;
  status?: string | null;
  score?: number | null;
  metadata?: string | LeadMeta | Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function parseMeta(raw: LeadCaptureRow["metadata"]): LeadMeta {
  if (!raw) return {};
  if (typeof raw === "object") return raw as LeadMeta;
  try {
    const parsed = JSON.parse(raw) as LeadMeta;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { notes: raw };
  }
}

export function normalizeDomain(value: string | null | undefined): Domain {
  const v = (value ?? "").toLowerCase();
  if ((DOMAINS as readonly string[]).includes(v)) return v as Domain;
  return "authichain";
}

export function normalizeStage(value: string | null | undefined): Stage {
  const v = (value ?? "new").toLowerCase();
  if (v === "customer") return "converted";
  if (v === "lost") return "new";
  if ((STAGES as readonly string[]).includes(v)) return v as Stage;
  return "new";
}

export function rowToLead(row: LeadCaptureRow): Lead {
  const meta = parseMeta(row.metadata);
  const domain = normalizeDomain(row.product_interest);
  const status = (row.status ?? "new").toLowerCase();
  const lost = Boolean(meta.lost) || status === "lost";
  const stage = status === "lost" ? normalizeStage("new") : normalizeStage(row.status);
  const email = (row.email ?? "").toLowerCase();
  const company = meta.company || row.name || email.split("@")[1] || "Unknown";
  return {
    id: row.id,
    name: row.name || meta.title || email,
    title: meta.title || "Contact",
    company,
    email,
    domain,
    stage,
    score: Number(row.score ?? 0),
    value: meta.value ?? DOMAIN_META[domain].defaultValue,
    city: meta.city || "—",
    notes: meta.notes || "",
    lastTouch: meta.lastTouch || row.updated_at || row.created_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
    draftPending: Boolean(meta.draftPending),
    activities: meta.activities ?? [],
    source: meta.source,
    lost,
  };
}

export function leadToRowPatch(lead: Lead) {
  const meta: LeadMeta = {
    title: lead.title,
    company: lead.company,
    city: lead.city,
    notes: lead.notes,
    lastTouch: lead.lastTouch,
    draftPending: lead.draftPending,
    lost: Boolean(lead.lost),
    value: lead.value,
    activities: lead.activities,
    source: lead.source,
  };
  return {
    name: lead.name,
    product_interest: lead.domain,
    status: lead.lost ? "lost" : lead.stage,
    score: lead.score,
    metadata: JSON.stringify(meta),
    updated_at: new Date().toISOString(),
    source: lead.source === "sam" ? "sam" : lead.source === "founder" ? "founder" : "website",
  };
}
