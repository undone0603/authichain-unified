-- 20260819000004_drop_dead_auth_policies.sql
--
-- Finishes the type alignment started in 20260819000003 by removing what
-- blocked the last 6 columns: RLS policies and foreign keys pointing at
-- Supabase auth.
--
-- WHY THIS IS NOT A SECURITY REDUCTION
--
-- auth.users has 0 rows and auth.uid() returns NULL, so every
-- `auth.uid() = user_id` predicate below evaluates to NULL and matches no row.
-- These policies grant nothing today. Dropping them removes dead enforcement;
-- it does not open access that was previously closed. Under RLS, removing a
-- policy without replacing it means default-deny, not default-allow.
--
-- products keeps "Public Read" (qual: true), "Public verify registered
-- products" and "Service role products access", so product reads are unchanged
-- and writes stay service-role only.
--
-- Scope is limited to policies that blocked the conversion. The other
-- auth.uid() policies in this database — on nfts, qrons, portals, profiles,
-- projects, story_videos, user_profiles, users, checkout_sessions, missions,
-- mission_tasks and qron_generations — are untouched.
--
-- Validated against the live database inside a transaction that was rolled
-- back: 6 columns converted, 5 affiliate uuids preserved, 3 products policies
-- remaining.

DROP POLICY IF EXISTS "Users view own products"             ON products;
DROP POLICY IF EXISTS "Users update own products"           ON products;
DROP POLICY IF EXISTS "Users insert own products"           ON products;
DROP POLICY IF EXISTS "Users can view own affiliate record" ON affiliates;
-- transitive dependency: this one subqueries affiliates.user_id
DROP POLICY IF EXISTS "Users can view own commissions"      ON affiliate_commissions;
DROP POLICY IF EXISTS "Users can view own bonuses"          ON bonuses;
DROP POLICY IF EXISTS "Users can view own health scores"    ON customer_health_scores;

-- Foreign keys to auth.users(id), a table with no rows.
ALTER TABLE bonuses             DROP CONSTRAINT IF EXISTS bonuses_user_id_fkey;
ALTER TABLE autopilot_config    DROP CONSTRAINT IF EXISTS autopilot_config_updated_by_fkey;
ALTER TABLE autopilot_decisions DROP CONSTRAINT IF EXISTS autopilot_decisions_overridden_by_fkey;

-- affiliates.user_id holds 5 uuids referencing an empty auth.users, so they
-- point at nothing. Keep them rather than discard them silently.
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS legacy_auth_uid uuid;
UPDATE affiliates SET legacy_auth_uid = user_id WHERE user_id IS NOT NULL;

-- Ownership is unassigned until real users exist, so these cannot stay NOT NULL.
ALTER TABLE affiliates ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE bonuses    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE products               ALTER COLUMN user_id       TYPE integer USING NULL::integer;
ALTER TABLE affiliates             ALTER COLUMN user_id       TYPE integer USING NULL::integer;
ALTER TABLE bonuses                ALTER COLUMN user_id       TYPE integer USING NULL::integer;
ALTER TABLE customer_health_scores ALTER COLUMN user_id       TYPE integer USING NULL::integer;
ALTER TABLE autopilot_config       ALTER COLUMN updated_by    TYPE integer USING NULL::integer;
ALTER TABLE autopilot_decisions    ALTER COLUMN overridden_by TYPE integer USING NULL::integer;
