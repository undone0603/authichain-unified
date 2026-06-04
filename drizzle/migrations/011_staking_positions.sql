-- drizzle/migrations/011_staking_positions.sql
-- Adds the staking_positions table backing the admin platformStaking query
-- and server/staking/db.ts helpers. The Drizzle schema defined this table
-- in the 007 era but it was never added to the migration set.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.staking_positions (
  id                      SERIAL PRIMARY KEY,
  "userId"                INTEGER       NOT NULL,
  "agentId"               INTEGER,
  amount                  NUMERIC(20,9) NOT NULL,
  status                  VARCHAR(50)   NOT NULL DEFAULT 'active',
  multiplier              NUMERIC(5,2)  NOT NULL DEFAULT 1.00,
  apy                     NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  "rewardsEarned"         NUMERIC(20,9) NOT NULL DEFAULT 0,
  "lastRewardCalculation" TIMESTAMP,
  "stakedAt"              TIMESTAMP     NOT NULL DEFAULT now(),
  "releaseAt"             TIMESTAMP,
  "createdAt"             TIMESTAMP     NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staking_positions_userId_idx
  ON public.staking_positions ("userId");

CREATE INDEX IF NOT EXISTS staking_positions_status_idx
  ON public.staking_positions (status);
