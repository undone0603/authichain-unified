-- DRAFT (not applied) | /verify lead magnet email capture | Acted-by: CF Deploy
-- QRON-v2 project, new table public.verify_email_captures.
-- Down (rollback):
--   DROP TABLE IF EXISTS public.verify_email_captures;
-- Additive only. Anon may INSERT only rows with consent = true; anon cannot SELECT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.verify_email_captures (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        text        NOT NULL CHECK (char_length(email) <= 254 AND email = lower(email)),
  consent      boolean     NOT NULL CHECK (consent = true),
  consented_at timestamptz NOT NULL DEFAULT now(),
  source       text        NOT NULL DEFAULT 'verify' CHECK (source = 'verify'),
  qron_id      text        CHECK (qron_id IS NULL OR char_length(qron_id) <= 512),
  decision     text        CHECK (decision IS NULL OR char_length(decision) <= 64),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verify_email_captures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.verify_email_captures FROM anon, authenticated;
GRANT INSERT (email, consent, consented_at, source, qron_id, decision)
  ON public.verify_email_captures TO anon;

CREATE POLICY verify_email_captures_anon_insert
  ON public.verify_email_captures FOR INSERT TO anon
  WITH CHECK (consent = true AND source = 'verify');

CREATE INDEX IF NOT EXISTS verify_email_captures_email_idx
  ON public.verify_email_captures (email);
