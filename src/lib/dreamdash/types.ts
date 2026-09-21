export const DOMAINS = ["authichain", "qron", "strainchain", "govchain"] as const;
export type Domain = (typeof DOMAINS)[number];

export const STAGES = [
  "new",
  "contacted",
  "qualified",
  "demoed",
  "contracted",
  "signed",
  "converted",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  demoed: "Demoed",
  contracted: "Contracted",
  signed: "Signed",
  converted: "Converted",
};

export const STAGE_BAR: Record<Stage, string> = {
  new: "bg-zinc-500/20",
  contacted: "bg-zinc-400/30",
  qualified: "bg-zinc-300/40",
  demoed: "bg-zinc-200/50",
  contracted: "bg-[#d4b45a]/55",
  signed: "bg-[#d4b45a]/78",
  converted: "bg-[#d4b45a]",
};

export const DOMAIN_TICK: Record<Domain, string> = {
  authichain: "bg-[#d4b45a]",
  qron: "bg-emerald-400",
  strainchain: "bg-[#b8b4aa]",
  govchain: "bg-[#f2efe8]",
};

export const DOMAIN_META: Record<
  Domain,
  { label: string; host: string; pitch: string; defaultValue: number }
> = {
  authichain: {
    label: "AuthiChain",
    host: "authichain.com",
    pitch: "Product authentication & American Seal",
    defaultValue: 15000,
  },
  qron: {
    label: "QRON",
    host: "qron.space",
    pitch: "Living QR codes & on-chain certificates",
    defaultValue: 2990,
  },
  strainchain: {
    label: "StrainChain",
    host: "strainchain.io",
    pitch: "Seed-to-sale provenance for cannabis",
    defaultValue: 18000,
  },
  govchain: {
    label: "GovChain",
    host: "govchain.us",
    pitch: "Public credentials & chain of custody",
    defaultValue: 45000,
  },
};

export const ACTIVITY_KINDS = [
  "capture",
  "score",
  "nurture",
  "advance",
  "draft",
  "sent",
  "opened",
  "clicked",
  "demo",
  "followup",
  "note",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  capture: "Captured",
  score: "Scored",
  nurture: "Nurture",
  advance: "Advanced",
  draft: "Draft",
  sent: "Sent",
  opened: "Opened",
  clicked: "Clicked",
  demo: "Demo",
  followup: "Follow-up",
  note: "Note",
};

export const ENGAGEMENT_BUMP: Record<ActivityKind, number> = {
  capture: 0,
  score: 0,
  nurture: 2,
  advance: 4,
  draft: 4,
  sent: 8,
  opened: 15,
  clicked: 25,
  demo: 40,
  followup: 6,
  note: 0,
};

export const LEAD_SOURCES = ["inbound", "sam", "founder"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  inbound: "Inbound",
  sam: "SAM.gov",
  founder: "Founder",
};

export const STALE_MS = 3 * 24 * 3600_000;

export interface Activity {
  id: string;
  kind: ActivityKind;
  timestamp: string;
  detail: string;
}

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  domain: Domain;
  stage: Stage;
  score: number;
  value: number;
  city: string;
  notes: string;
  lastTouch: string;
  createdAt: string;
  draftPending: boolean;
  activities: Activity[];
  source?: LeadSource;
  lost?: boolean;
}

export type EventStatus = "ok" | "queued" | "skipped";

export interface HeartbeatEvent {
  id: string;
  workflow: string;
  status: EventStatus;
  timestamp: string;
  detail: string;
}

export interface CycleReport {
  at: string;
  scored: number;
  nurtured: number;
  advanced: number;
  followups: number;
}

export type DomainFilter = "all" | Domain;
export type StageFilter = "all" | Stage;
export type BoardSort = "score" | "value" | "touch" | "stale";
export type DashView = "today" | "board" | "ops";

export interface CaptureInput {
  name: string;
  title: string;
  company: string;
  email: string;
  domain: Domain;
  city: string;
  notes: string;
}

export interface LeadMeta {
  title?: string;
  company?: string;
  city?: string;
  notes?: string;
  lastTouch?: string;
  draftPending?: boolean;
  lost?: boolean;
  value?: number;
  activities?: Activity[];
  source?: LeadSource;
}
