-- 20260819000003_type_alignment.sql
--
-- The drift check compares column NAMES, not types, so a declaration can name a
-- real column and still be wrong about what it holds. 60 such mismatches
-- existed. This migration is the database half of closing 54 of them; the other
-- half is the declarations, in the same commit.
--
-- The shape of the problem: the database carried two user identity systems.
-- users.id is integer; 46 columns named user_id were uuid, pointing at Supabase
-- auth. auth.users has 0 rows and users_legacy has 0 rows, while users has 2 —
-- so the uuid side was an unadopted design, not a live system. Every uuid
-- ownership column was NULL, including on 1694 products and 544
-- authentications.
--
-- The resolution: uuid stays where it is load-bearing (surrogate primary keys
-- holding real data, and the foreign keys between them); ownership moves to
-- integer to match the users table that actually has users in it.
--
-- Validated against the live database inside a transaction that was rolled
-- back before applying: 15 columns converted, all 4428 activity_log entityIds
-- preserved.
--
-- NOT changed — 6 columns stay uuid because something real depends on it:
--   products.user_id, affiliates.user_id, bonuses.user_id,
--   customer_health_scores.user_id   RLS policies of the form
--                                    `auth.uid() = user_id`. Converting them
--                                    would break row-level ownership
--                                    enforcement, which is a security decision.
--   autopilot_config.updated_by,
--   autopilot_decisions.overridden_by  foreign keys to auth.users(id).
-- Their declarations still say integer. That disagreement is real and is left
-- visible rather than papered over.

-- Ownership columns move to integer to match users.id. Every one is entirely
-- NULL, so nothing is lost.
ALTER TABLE authentications ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE certificates ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE qr_codes ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE usage_records ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE invoices ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE payments ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE email_campaigns ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE referrals ALTER COLUMN referrer_id TYPE integer USING NULL::integer;
ALTER TABLE white_label_clients ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE fraud_alerts ALTER COLUMN user_id TYPE integer USING NULL::integer;
ALTER TABLE fraud_alerts ALTER COLUMN resolved_by TYPE integer USING NULL::integer;
ALTER TABLE revenue_records ALTER COLUMN "userId" TYPE integer USING NULL::integer;
ALTER TABLE auctions ALTER COLUMN seller_id TYPE integer USING NULL::integer;
ALTER TABLE auctions ALTER COLUMN highest_bidder_id TYPE integer USING NULL::integer;
ALTER TABLE auction_bids ALTER COLUMN bidder_id TYPE integer USING NULL::integer;

-- activity_log records entity ids from both integer- and uuid-keyed tables, so
-- the column has to be text. integer::text preserves all 4428 existing values.
ALTER TABLE activity_log ALTER COLUMN "entityId" TYPE text USING "entityId"::text;

-- These reference uuid primary keys, so they follow their target rather than
-- the ownership rule. Both are empty.
ALTER TABLE qr_codes ALTER COLUMN product_id TYPE uuid USING NULL::uuid;
ALTER TABLE api_usage_daily ALTER COLUMN "tenantId" TYPE uuid USING NULL::uuid;

-- clientId is a legacy integer tenant reference that cannot be populated now
-- that white_label_clients.id is uuid. Nothing writes it; make it optional
-- rather than force a fabricated value.
ALTER TABLE api_usage_daily ALTER COLUMN "clientId" DROP NOT NULL;
