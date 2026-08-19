-- 20260819000005_populate_ownership.sql
--
-- Two things: assign owners to the 2303 rows that had none, and rewrite the RLS
-- policies dropped in 20260819000004 so they key off users.id.
--
-- ─── The backfill is an assignment, not a reconstruction ─────────────────────
--
-- These rows carry NO record of who created them. There is no created_by
-- column on products; activity_log has entries for automation, campaign,
-- marketing, payout, reporting, retention, seo_batch and task, but none for
-- products; and the only "user" strings in products.metadata are Windows paths
-- (C:\Users\rac\...), not owner references.
--
-- So this is a decision, not evidence recovery. users.id = 4
-- (undone.k@gmail.com, role admin) is the account behind every other ownership
-- record in this database — 42 of 48 notifications and 42 of 48 activity_log
-- rows, against 6 each for id = 1, a test account. Assigning the unowned rows
-- to id = 4 is consistent with everything the database does record.
--
-- Reversible: UPDATE <table> SET user_id = NULL WHERE user_id = 4.
--
-- ─── The policies are correct but dormant ────────────────────────────────────
--
-- RLS can only see Supabase auth claims. auth.uid() returns a uuid, while
-- users.openId holds provider subjects ('google:114675752313451582343', and a
-- nanoid) that are not uuids — so there was no path from a policy to users.id
-- at all. users.auth_uid is that bridge.
--
-- It is empty, because auth.users has 0 rows. These policies are therefore
-- inert today: they will match nothing until a Supabase auth user exists and
-- is linked via users.auth_uid. That is stated plainly rather than left for a
-- reader to discover. They are written now so the enforcement is correct by
-- construction the moment auth is adopted.
--
-- Separately, the application server connects as the database owner, which
-- bypasses RLS entirely. These policies govern the anon/authenticated Supabase
-- keys used from the browser, not the tRPC layer, where authorization lives in
-- protectedProcedure.
--
-- Validated against the live database inside a transaction that was rolled
-- back: 2303 rows owned, 0 left null, 10 policies present.

-- Two ownership columns were still uuid and entirely NULL; they join the
-- integer side so they can hold a users.id like the rest. The FK pointed at
-- auth.users(id), a table with no rows.
ALTER TABLE supply_chain_events DROP CONSTRAINT IF EXISTS supply_chain_events_user_id_fkey;
ALTER TABLE supply_chain_events ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE email_drafts        ALTER COLUMN user_id TYPE integer USING NULL::integer;

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid uuid;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_uid_key ON users (auth_uid) WHERE auth_uid IS NOT NULL;

UPDATE products            SET user_id = 4 WHERE user_id IS NULL;  -- 1694
UPDATE authentications     SET user_id = 4 WHERE user_id IS NULL;  --  544
UPDATE supply_chain_events SET user_id = 4 WHERE user_id IS NULL;  --   48
UPDATE email_drafts        SET user_id = 4 WHERE user_id IS NULL;  --   12
UPDATE affiliates          SET user_id = 4 WHERE user_id IS NULL;  --    5

CREATE POLICY "Users view own products"   ON products FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_uid = (select auth.uid())));
CREATE POLICY "Users update own products" ON products FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_uid = (select auth.uid())));
CREATE POLICY "Users insert own products" ON products FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_uid = (select auth.uid())));
CREATE POLICY "Users can view own affiliate record" ON affiliates FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_uid = (select auth.uid())));
CREATE POLICY "Users can view own commissions" ON affiliate_commissions FOR SELECT
  USING (affiliateid IN (SELECT a.id FROM affiliates a JOIN users u ON u.id = a.user_id WHERE u.auth_uid = (select auth.uid())));
CREATE POLICY "Users can view own bonuses" ON bonuses FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_uid = (select auth.uid())));
CREATE POLICY "Users can view own health scores" ON customer_health_scores FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_uid = (select auth.uid())));
