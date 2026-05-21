-- Migration: add bayesian_priors table for adaptive conversion scoring
-- Referenced by server/db.ts getAdaptivePriors() — was in schema but missing from migrations.

CREATE TABLE IF NOT EXISTS "bayesian_priors" (
  "id"                  serial PRIMARY KEY,
  "segment"             varchar(64)         NOT NULL UNIQUE,
  "priorAlpha"          numeric(10, 4)      DEFAULT '2.0000',
  "priorBeta"           numeric(10, 4)      DEFAULT '18.0000',
  "currentMean"         numeric(5, 4)       DEFAULT '0.1000',
  "observationsCount"   integer             DEFAULT 0,
  "updatedAt"           timestamp           NOT NULL DEFAULT now()
);
