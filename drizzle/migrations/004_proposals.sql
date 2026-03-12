-- 004: Proposals table for autonomous close tracking
CREATE TABLE IF NOT EXISTS proposals (
  "id"                VARCHAR(36) PRIMARY KEY,
  "leadEmail"         VARCHAR(320) NOT NULL,
  "missionId"         VARCHAR(36) NOT NULL,
  "taskId"            VARCHAR(36),
  "segment"           VARCHAR(20) NOT NULL DEFAULT 'GOV',
  "content"           TEXT NOT NULL,
  "paymentLink"       TEXT,
  "checkoutSessionId" VARCHAR(128),
  "status"            VARCHAR(20) NOT NULL DEFAULT 'SENT',
  "pilotPriceUsd"     INTEGER NOT NULL DEFAULT 0,
  "sentAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "acceptedAt"        TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposals_lead_email_idx ON proposals ("leadEmail");
CREATE INDEX IF NOT EXISTS proposals_status_idx    ON proposals ("status");

-- Mark proposals ACCEPTED when Stripe webhook fires (handled via application layer)
-- No DB trigger needed — webhook handler calls UPDATE proposals SET status='ACCEPTED' WHERE checkoutSessionId=...
