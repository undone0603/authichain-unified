-- drizzle/migrations/013_feedback_personalization.sql
-- Creates feedback, feedback_votes, visitor_profiles, personalization_rules,
-- and personalization_events tables which were in the codebase but never migrated.
-- Without these tables the feedback and personalization routers throw 42P01 errors.
-- Idempotent: safe to re-run.

-- ── feedback ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id               SERIAL PRIMARY KEY,
  "userId"         INTEGER,
  type             VARCHAR(50)  NOT NULL,
  title            VARCHAR(256) NOT NULL,
  description      TEXT,
  status           VARCHAR(50)  NOT NULL DEFAULT 'new',
  priority         VARCHAR(50)  NOT NULL DEFAULT 'medium',
  votes            INTEGER      NOT NULL DEFAULT 0,
  "adminResponse"  TEXT,
  "createdAt"      TIMESTAMP    NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_userId_idx ON public.feedback ("userId");
CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback (status);

-- ── feedback_votes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback_votes (
  id           SERIAL PRIMARY KEY,
  "feedbackId" INTEGER     NOT NULL,
  "userId"     INTEGER     NOT NULL,
  "voteType"   VARCHAR(10) NOT NULL,
  "createdAt"  TIMESTAMP   NOT NULL DEFAULT now(),
  UNIQUE ("feedbackId", "userId")
);

-- ── visitor_profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visitor_profiles (
  id              SERIAL PRIMARY KEY,
  "sessionId"     VARCHAR(128) NOT NULL UNIQUE,
  "ipAddress"     VARCHAR(64),
  country         VARCHAR(64),
  city            VARCHAR(128),
  region          VARCHAR(128),
  "trafficSource" VARCHAR(64),
  referrer        TEXT,
  "utmSource"     VARCHAR(128),
  "utmMedium"     VARCHAR(128),
  "utmCampaign"   VARCHAR(128),
  "deviceType"    VARCHAR(20)  NOT NULL DEFAULT 'desktop',
  segment         VARCHAR(64),
  "pageViews"     INTEGER      NOT NULL DEFAULT 0,
  converted       INTEGER      NOT NULL DEFAULT 0,
  "lastSeen"      TIMESTAMP    NOT NULL DEFAULT now(),
  "createdAt"     TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_profiles_sessionId_idx ON public.visitor_profiles ("sessionId");
CREATE INDEX IF NOT EXISTS visitor_profiles_segment_idx   ON public.visitor_profiles (segment);

-- ── personalization_rules ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personalization_rules (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(256) NOT NULL,
  description       TEXT,
  "targetElement"   VARCHAR(128) NOT NULL,
  conditions        TEXT,
  content           TEXT         NOT NULL,
  priority          INTEGER      NOT NULL DEFAULT 0,
  status            VARCHAR(50)  NOT NULL DEFAULT 'draft',
  "aiGenerated"     INTEGER      NOT NULL DEFAULT 0,
  views             INTEGER      NOT NULL DEFAULT 0,
  conversions       INTEGER      NOT NULL DEFAULT 0,
  "conversionRate"  NUMERIC(6,2) NOT NULL DEFAULT 0,
  "createdBy"       INTEGER,
  "createdAt"       TIMESTAMP    NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personalization_rules_status_idx  ON public.personalization_rules (status);
CREATE INDEX IF NOT EXISTS personalization_rules_element_idx ON public.personalization_rules ("targetElement");

-- ── personalization_events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personalization_events (
  id           SERIAL PRIMARY KEY,
  "ruleId"     INTEGER      NOT NULL,
  "sessionId"  VARCHAR(128) NOT NULL,
  "eventType"  VARCHAR(50)  NOT NULL,
  "createdAt"  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personalization_events_ruleId_idx    ON public.personalization_events ("ruleId");
CREATE INDEX IF NOT EXISTS personalization_events_sessionId_idx ON public.personalization_events ("sessionId");
