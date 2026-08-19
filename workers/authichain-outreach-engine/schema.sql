-- authichain-outreach-engine schema (D1: authichain-db, ebd8081b-ac13-485a-8b0e-a6cd9c0f7be5)
-- These tables PRE-EXIST in production (created ~May 2026); this file documents them
-- and is safe to re-run (IF NOT EXISTS). Lead lifecycle: new -> sent | failed | suppressed.

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  title TEXT,
  phone TEXT,
  source TEXT,
  score INTEGER DEFAULT 0,          -- AgentZ "priority" maps here
  status TEXT DEFAULT 'new',        -- new (pending) | sent | failed | suppressed
  industry TEXT,
  notes TEXT,
  last_contacted_at TEXT,
  assigned_to INTEGER,
  segment TEXT,
  next_action_at TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,         -- dod_supply_chain_email, pharma_traceability_email,
                                    -- luxury_brand_protection_email, generic_b2b_email
  subject TEXT NOT NULL,            -- supports {{company}} / {{contact_name}}
  body_markdown TEXT NOT NULL       -- stored with literal \n sequences
);

CREATE TABLE IF NOT EXISTS outreach_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  template_key TEXT,
  provider TEXT,                    -- resend, sendgrid, mailchannels
  status TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
