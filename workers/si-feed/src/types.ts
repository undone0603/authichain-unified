export const TRANSPORTS = ["mcp", "cli", "rss", "webhook", "api", "agent"] as const;
export const SEVERITIES = ["debug", "info", "warning", "critical"] as const;
export const KINDS = ["observed", "derived", "interpreted", "projected", "unknown"] as const;

export type Transport = (typeof TRANSPORTS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type ClaimKind = (typeof KINDS)[number];

export interface IngestBody {
  tenant_id: string;
  ts?: string;
  source: string;
  transport: Transport;
  type: string;
  severity?: Severity;
  entity: string;
  summary: string;
  data?: Record<string, unknown>;
  dedupe_key?: string;
}

export interface SiEvent {
  id: string;
  tenant_id: string;
  ts: string;
  source: string;
  transport: Transport;
  type: string;
  severity: Severity;
  entity: string;
  summary: string;
  data_json: string;
  dedupe_key: string;
  status: string;
}

export interface StoryClaim {
  story_id: string;
  claim: string;
  kind: ClaimKind;
  evidence: string[];
  confidence: "verified" | "inferred" | "hypothesis" | "insufficient";
  generated_by: "StoryMode";
}

export interface Env {
  SI_DB: D1Database;
  SI_STORY_QUEUE: Queue;
  INGEST_TOKEN?: string;
  STORY_LLM_ENABLED?: string;
  PUBLIC_KINDS?: string;
}
