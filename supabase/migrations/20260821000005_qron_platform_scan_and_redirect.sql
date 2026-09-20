-- qron-platform: create scan_logs and the redirect-rule columns the live code reads.
--
-- These were found by pointing check-schema-drift.mjs at the sub-app's schema
-- (the --also flag added in #744, which reported but did not gate). Two of the
-- findings are not cosmetic — the sub-app's own code depends on them today:
--
--   scan_logs                     apps/qron-platform/src/app/s/[shortcode]/route.ts
--     The public QR redirect handler inserts one row per scan. The table does
--     not exist, so every scan raises 42P01. The insert is fire-and-forget with
--     a .then(undefined, err => console.error(...)) tail, so the redirect still
--     works and nothing surfaces — scan analytics have simply never recorded
--     anything. autonomous-controller.ts reads the same table twice.
--
--   redirect_rules.configuration  same file, the rule-evaluation loop
--     Rules are fetched with select('*'), which succeeds, so no error is ever
--     logged. But `configuration` does not exist, so rule.configuration is
--     always undefined and the branch that actually redirects —
--       if (rule.configuration?.redirect_url) destination = ...
--     can never be taken. Every redirect rule silently does nothing and all
--     traffic goes to the default target_url. start_time/end_time are absent
--     the same way, so scheduled windows never apply either.
--
-- The remaining two columns (folders.updated_at, lead_sequences.metadata) are
-- declared in the sub-app schema and simply missing; added for consistency.
--
-- Every statement either creates a new table or adds a column with a default,
-- so no existing row can be invalidated. Validated in a rolled-back transaction
-- before being applied.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.scan_logs;
--   ALTER TABLE public.redirect_rules
--     DROP COLUMN IF EXISTS configuration,
--     DROP COLUMN IF EXISTS start_time,
--     DROP COLUMN IF EXISTS end_time;
--   ALTER TABLE public.folders DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE public.lead_sequences DROP COLUMN IF EXISTS metadata;

CREATE TABLE IF NOT EXISTS public.scan_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qron_id    integer REFERENCES public.qrons(id) ON DELETE CASCADE,
  ip         text,
  country    text,
  region     text,
  city       text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_qron    ON public.scan_logs(qron_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_created ON public.scan_logs(created_at);

ALTER TABLE public.redirect_rules
  ADD COLUMN IF NOT EXISTS configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS start_time    timestamptz,
  ADD COLUMN IF NOT EXISTS end_time      timestamptz;

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.lead_sequences
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- scan_logs is created with RLS enabled and no policies, which is default-deny:
-- without these the insert from the public redirect handler fails on RLS
-- instead of 42P01 and the feature stays exactly as broken.
--
-- Deliberately no public SELECT. qrons and redirect_rules each carry a
-- "Public Read Active ..." policy, but scan rows hold visitor IP addresses, so
-- reads are limited to the owner of the scanned qron and the service role.
-- INSERT is unconditional because the writer is an unauthenticated visitor.

CREATE POLICY "Anyone can log a scan" ON public.scan_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view scans of own qrons" ON public.scan_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.qrons q WHERE q.id = scan_logs.qron_id AND q.user_id = auth.uid())
  );

CREATE POLICY "Service role scan_logs access" ON public.scan_logs
  FOR ALL USING (auth.role() = 'service_role');
