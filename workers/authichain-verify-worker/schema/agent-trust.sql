CREATE TABLE IF NOT EXISTS agent_issuers (
  issuer_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  is_revoked INTEGER NOT NULL DEFAULT 0 CHECK (is_revoked IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_attestations (
  attestation_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL REFERENCES agent_issuers(issuer_id),
  role TEXT NOT NULL,
  version TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  public_key TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  expires_at TEXT,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (expires_at IS NULL OR expires_at > effective_at)
);

CREATE INDEX IF NOT EXISTS idx_agent_attestations_agent
  ON agent_attestations(agent_id, attestation_id);

CREATE INDEX IF NOT EXISTS idx_agent_attestations_org_agent
  ON agent_attestations(organization_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_attestations_issuer
  ON agent_attestations(issuer_id);

CREATE TABLE IF NOT EXISTS agent_attestation_revocations (
  attestation_id TEXT PRIMARY KEY REFERENCES agent_attestations(attestation_id),
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_by TEXT NOT NULL,
  evidence_reference TEXT
);

CREATE TABLE IF NOT EXISTS agent_message_nonces (
  message_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  attestation_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  message_digest TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_message_nonces_expiry
  ON agent_message_nonces(expires_at);
