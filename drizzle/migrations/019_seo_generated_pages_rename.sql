-- 018_seo_pages.sql's CREATE TABLE IF NOT EXISTS "seo_pages" silently
-- no-op'd: a DIFFERENT, pre-existing "seo_pages" table already occupied that
-- name (SEO analytics tracking -- impressions, clicks, avg_position,
-- category -- unrelated purpose/schema, presumably from an earlier agent).
-- Every insert from server/agents/seo-content.ts then failed with "column
-- does not exist" (e.g. "keyword", "bodyHtml") against the wrong table.
-- Renamed to seo_generated_pages to avoid the collision. The old
-- (never-populated, since every insert failed) 018 migration is left as
-- historical record rather than rewritten.
CREATE TABLE IF NOT EXISTS "seo_generated_pages" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" varchar(80) NOT NULL UNIQUE,
  "keyword" varchar(256) NOT NULL,
  "brand" varchar(64) NOT NULL,
  "domain" varchar(128) NOT NULL,
  "title" varchar(60) NOT NULL,
  "metaDescription" varchar(155) NOT NULL,
  "h1" varchar(256) NOT NULL,
  "bodyHtml" text NOT NULL,
  "jsonLd" jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
