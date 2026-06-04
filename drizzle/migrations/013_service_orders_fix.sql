-- drizzle/migrations/013_service_orders_fix.sql
-- Add serviceType and priority columns to service_orders (created in 012 without them).
-- Applied to QRON-v2 Supabase project on 2026-06-04.

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS "serviceType" VARCHAR(64);
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
