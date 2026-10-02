CREATE TABLE IF NOT EXISTS public.si_feed_consents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('agentz', 'automation', 'github')),
  share_public boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'si-feed-public-v1',
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source)
);

CREATE INDEX IF NOT EXISTS idx_si_feed_consents_public_source
  ON public.si_feed_consents (source)
  WHERE share_public = true;

ALTER TABLE public.si_feed_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.si_feed_consents FROM anon, authenticated;
GRANT ALL ON public.si_feed_consents TO service_role;

CREATE TABLE IF NOT EXISTS public.si_feed_webhook_deliveries (
  delivery_id text PRIMARY KEY CHECK (length(delivery_id) BETWEEN 1 AND 100),
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.si_feed_webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.si_feed_webhook_deliveries FROM anon, authenticated;
GRANT ALL ON public.si_feed_webhook_deliveries TO service_role;
