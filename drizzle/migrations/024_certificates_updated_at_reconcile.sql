-- Reconcile the one schema gap found in the live production audit.
-- 021_certificate_nft_columns.sql expects this column, but production was
-- missing it. Keep 021 immutable and record the repair as a new migration.

ALTER TABLE "certificates"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP;
