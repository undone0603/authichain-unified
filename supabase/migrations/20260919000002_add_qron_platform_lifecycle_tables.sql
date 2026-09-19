-- 20260919000002_add_qron_platform_lifecycle_tables.sql
--
-- Fixes the remaining two breaking findings from schema-drift.yml's --also
-- check of apps/qron-platform/src/db/schema.ts: product_lifecycle_events and
-- component_provenance are declared there but absent from the database.
--
-- Unlike the api_usage / provisioning_state fix in the prior migration, these
-- two are not (yet) read or written anywhere in the codebase — grep across
-- the repo finds no reference to productLifecycleEvents or componentProvenance
-- outside their own declaration. So today they are dormant: nothing queries
-- them, so nothing is currently failing. They become a live 42P01 the moment
-- any route starts using them without a migration, which this pre-empts.
--
-- Both tables reference products.id (uuid, shared by src/db/schema.ts and
-- apps/qron-platform/src/db/schema.ts — same physical `products` table).
-- Definitions match apps/qron-platform/src/db/schema.ts exactly.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "product_lifecycle_events" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id"      UUID NOT NULL REFERENCES "products"("id"),
  "event_type"      TEXT NOT NULL, -- 'manufactured', 'shipped', 'serviced', 'recycled'
  "event_timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  "location"        TEXT,
  "actor_id"        UUID,
  "evidence_hash"   TEXT,
  "metadata"        JSONB DEFAULT '{}',
  "created_at"      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_lifecycle_product"
  ON "product_lifecycle_events" ("product_id");

CREATE TABLE IF NOT EXISTS "component_provenance" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id"       UUID NOT NULL REFERENCES "products"("id"),
  "component_name"   TEXT NOT NULL,
  "origin_country"   TEXT,
  "supplier_id"      UUID,
  "material_cert"    TEXT,
  "anchored_tx"      TEXT,
  "created_at"       TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_provenance_product"
  ON "component_provenance" ("product_id");
