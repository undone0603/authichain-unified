-- Outbound acquisition shape for the verify worker D1 database.
-- This file is NOT applied by deploy. The tested store is AcquisitionLedger.
-- Do not wrangler d1 execute this from an agent session.
-- Rows reference agent_attestations in schema/agent-trust.sql. They do not
-- define a second agent identity.

CREATE TABLE IF NOT EXISTS outbound_campaigns (
  campaign_id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  authorized INTEGER NOT NULL CHECK (authorized IN (0, 1)),
  human_send_approved INTEGER NOT NULL CHECK (human_send_approved IN (0, 1)),
  paused INTEGER NOT NULL CHECK (paused IN (0, 1)),
  allow_role_inbox INTEGER NOT NULL CHECK (allow_role_inbox IN (0, 1)),
  attribution TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_prospects (
  prospect_id TEXT PRIMARY KEY,
  organization TEXT NOT NULL,
  domain TEXT NOT NULL,
  vertical TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  intent_score INTEGER NOT NULL,
  urgency_score INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  recommended_offer TEXT,
  recommended_agent TEXT NOT NULL,
  contact_email TEXT,
  contact_source TEXT,
  status TEXT NOT NULL,
  discovered_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_opportunities (
  opportunity_id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES outbound_prospects(prospect_id),
  campaign_id TEXT NOT NULL REFERENCES outbound_campaigns(campaign_id),
  evidence_ids TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  recommended_agent TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  attribution TEXT NOT NULL,
  next_action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_audit (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  code TEXT NOT NULL,
  reasons TEXT NOT NULL,
  agent_id TEXT,
  organization_id TEXT,
  attestation_id TEXT,
  message_id TEXT,
  message_digest TEXT,
  prospect_id TEXT,
  opportunity_id TEXT,
  campaign_id TEXT,
  capability TEXT,
  policy_version TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_audit_agent ON outbound_audit(agent_id, at);
CREATE INDEX IF NOT EXISTS idx_outbound_audit_code ON outbound_audit(code);

CREATE TABLE IF NOT EXISTS outbound_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_sends (
  message_id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_conversations (
  conversation_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  prospect_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,
  reply_verified INTEGER NOT NULL DEFAULT 0 CHECK (reply_verified IN (0, 1)),
  context_verified INTEGER NOT NULL CHECK (context_verified IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS acquisition_funnel_events (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  at TEXT NOT NULL,
  prospect_id TEXT,
  opportunity_id TEXT,
  agent_id TEXT,
  campaign_id TEXT,
  offer_id TEXT,
  message_id TEXT,
  session_id TEXT,
  detail TEXT
);
