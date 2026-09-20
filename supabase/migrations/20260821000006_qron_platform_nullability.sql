-- Three columns are NOT NULL with no default in the database while the
-- sub-app's schema.ts declares them optional, and the live code inserts
-- without them. Each is a 23502 on a path that is meant to work.
--
--   redirect_rules.url            RedirectRulesManager builds its insert from a
--                                 newRule state object with no `url` key at
--                                 all: the destination now lives in
--                                 configuration.redirect_url. The NOT NULL is
--                                 left over from the older design, so creating
--                                 a rule through the UI has always failed.
--                                 redirect_rules holds 0 rows, which is what
--                                 that looks like from the outside.
--
--   certifications.name           The admin create route inserts product_id,
--                                 serial_number, status and metadata only.
--                                 Nothing reads certifications.name.
--
--   dpp_data.material_composition Supplied from an optional request field, so
--                                 it is absent whenever the caller omits it.
--
-- The other two findings in this table went the other way: brand_webhooks.brand
-- and profiles.user_id are always supplied by the code, so schema.ts was
-- tightened to notNull instead of loosening the database.
--
-- Only constraints are relaxed here, so no existing row can be invalidated.
-- Validated in a rolled-back transaction with inserts shaped exactly like the
-- live ones before being applied.
--
-- Rollback (only safe while every row still has a value for these):
--   ALTER TABLE public.redirect_rules ALTER COLUMN url SET NOT NULL;
--   ALTER TABLE public.certifications  ALTER COLUMN name SET NOT NULL;
--   ALTER TABLE public.dpp_data        ALTER COLUMN material_composition SET NOT NULL;

ALTER TABLE public.redirect_rules ALTER COLUMN url DROP NOT NULL;
ALTER TABLE public.certifications  ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.dpp_data        ALTER COLUMN material_composition DROP NOT NULL;
