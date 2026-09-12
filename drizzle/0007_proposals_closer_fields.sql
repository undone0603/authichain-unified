-- Closer GENERATE_PROPOSAL fields (mission/task linkage + Stripe checkout)
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "mission_id" varchar(64);
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "task_id" varchar(64);
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "payment_link" text;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "checkout_session_id" varchar(128);
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "pilot_price_usd" integer;
-- Live CRM-shaped proposals require title; closer inserts omit it unless defaulted.
ALTER TABLE "proposals" ALTER COLUMN "title" SET DEFAULT 'Untitled proposal';
