-- INERT schema proposal. Apply only to authorized disposable PostgreSQL.
-- No migration of production Supabase or Cloudflare D1 is performed.
CREATE TABLE IF NOT EXISTS agentz_commercial_replay_claims (
 claim_sha256 text PRIMARY KEY CHECK (claim_sha256 ~ '^[0-9a-f]{64}$'),
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 minimum_retain_until timestamptz NOT NULL
);
-- Dedicated runtime principal: INSERT only. No UPDATE, DELETE or TRUNCATE.
-- A separately approved retention policy must not enable claim-key reuse.
