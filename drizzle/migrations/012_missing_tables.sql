-- drizzle/migrations/012_missing_tables.sql
-- Creates 12 tables defined in schema.ts that were never migrated.
-- Without these tables many tRPC procedures throw PostgreSQL 42P01 errors.
-- Idempotent: safe to re-run.

-- ── api_usage_daily ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_daily (
  id          SERIAL PRIMARY KEY,
  "clientId"  INTEGER       NOT NULL,
  date        TIMESTAMP     NOT NULL,
  calls       INTEGER       NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP     NOT NULL DEFAULT now()
);

-- ── bonuses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonuses (
  id               SERIAL PRIMARY KEY,
  "userId"         INTEGER       NOT NULL,
  "bonusType"      VARCHAR(64)   NOT NULL,
  "bonusName"      VARCHAR(256)  NOT NULL,
  "bonusValue"     INTEGER       NOT NULL,
  "bonusTier"      VARCHAR(50),
  "bonusStatus"    VARCHAR(50)   NOT NULL DEFAULT 'pending',
  "deliveryMethod" VARCHAR(64),
  "claimedAt"      TIMESTAMP,
  "deliveredAt"    TIMESTAMP,
  "createdAt"      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bonuses_userId_idx ON public.bonuses ("userId");

-- ── referral_clicks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id              SERIAL PRIMARY KEY,
  "referralCode"  VARCHAR(32)   NOT NULL,
  "ipAddress"     VARCHAR(64),
  "userAgent"     TEXT,
  referer         TEXT,
  "landingPage"   TEXT,
  "convertedAt"   TIMESTAMP,
  "createdAt"     TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_clicks_code_idx ON public.referral_clicks ("referralCode");

-- ── ai_models ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_models (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(256)  NOT NULL,
  description     TEXT,
  category        VARCHAR(128),
  price           INTEGER       NOT NULL DEFAULT 0,
  "modelStatus"   VARCHAR(50)   NOT NULL DEFAULT 'draft',
  downloads       INTEGER       NOT NULL DEFAULT 0,
  rating          NUMERIC(3,2)  NOT NULL DEFAULT 0,
  "reviewCount"   INTEGER       NOT NULL DEFAULT 0,
  "creatorId"     INTEGER       NOT NULL,
  "createdAt"     TIMESTAMP     NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_models_creatorId_idx ON public.ai_models ("creatorId");
CREATE INDEX IF NOT EXISTS ai_models_status_idx    ON public.ai_models ("modelStatus");

-- ── model_purchases ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.model_purchases (
  id               SERIAL PRIMARY KEY,
  "userId"         INTEGER       NOT NULL,
  "modelId"        INTEGER       NOT NULL,
  "pricePaid"      INTEGER       NOT NULL,
  "purchaseType"   VARCHAR(50)   NOT NULL DEFAULT 'purchase',
  "purchaseStatus" VARCHAR(50)   NOT NULL DEFAULT 'active',
  "expiresAt"      TIMESTAMP,
  "createdAt"      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_purchases_userId_idx  ON public.model_purchases ("userId");
CREATE INDEX IF NOT EXISTS model_purchases_modelId_idx ON public.model_purchases ("modelId");

-- ── model_reviews ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.model_reviews (
  id          SERIAL PRIMARY KEY,
  "modelId"   INTEGER   NOT NULL,
  "userId"    INTEGER   NOT NULL,
  rating      INTEGER   NOT NULL,
  review      TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_reviews_modelId_idx ON public.model_reviews ("modelId");

-- ── prompt_cache ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prompt_cache (
  id           SERIAL PRIMARY KEY,
  "promptHash" VARCHAR(128)  NOT NULL UNIQUE,
  response     TEXT          NOT NULL,
  provider     VARCHAR(64),
  model        VARCHAR(64),
  usage        JSONB,
  "createdAt"  TIMESTAMP     NOT NULL DEFAULT now()
);

-- ── budget_config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_config (
  id             SERIAL PRIMARY KEY,
  "monthlyLimit" NUMERIC(18,2) NOT NULL,
  spent          NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  currency       VARCHAR(16)   NOT NULL DEFAULT 'USD',
  "updatedAt"    TIMESTAMP     NOT NULL DEFAULT now()
);

-- ── service_orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_orders (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER     NOT NULL,
  "serviceType" VARCHAR(64) NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority      INTEGER     NOT NULL DEFAULT 0,
  details       JSONB,
  "createdAt"   TIMESTAMP   NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_orders_userId_idx ON public.service_orders ("userId");
CREATE INDEX IF NOT EXISTS service_orders_status_idx ON public.service_orders (status);

-- ── platform_fees ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id              SERIAL PRIMARY KEY,
  "feeType"       VARCHAR(64)   NOT NULL,
  percentage      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  amount          NUMERIC(18,8) NOT NULL,
  "transactionId" INTEGER,
  description     TEXT,
  currency        VARCHAR(16)   NOT NULL DEFAULT 'USD',
  status          VARCHAR(50)   NOT NULL DEFAULT 'pending',
  "createdAt"     TIMESTAMP     NOT NULL DEFAULT now()
);

-- ── transactions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id          SERIAL PRIMARY KEY,
  "userId"    INTEGER       NOT NULL,
  type        VARCHAR(64)   NOT NULL,
  amount      NUMERIC(18,8) NOT NULL,
  "feeAmount" NUMERIC(18,8) NOT NULL DEFAULT 0,
  "stakingId" INTEGER,
  currency    VARCHAR(16)   NOT NULL DEFAULT 'USD',
  status      VARCHAR(50)   NOT NULL DEFAULT 'pending',
  metadata    JSONB,
  "createdAt" TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_userId_idx ON public.transactions ("userId");
CREATE INDEX IF NOT EXISTS transactions_status_idx ON public.transactions (status);

-- ── bayesian_priors ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bayesian_priors (
  id                  SERIAL PRIMARY KEY,
  segment             VARCHAR(64)   NOT NULL UNIQUE,
  "priorAlpha"        NUMERIC(10,4) NOT NULL DEFAULT 2.0000,
  "priorBeta"         NUMERIC(10,4) NOT NULL DEFAULT 18.0000,
  "currentMean"       NUMERIC(5,4)  NOT NULL DEFAULT 0.1000,
  "observationsCount" INTEGER       NOT NULL DEFAULT 0,
  "updatedAt"         TIMESTAMP     NOT NULL DEFAULT now()
);
