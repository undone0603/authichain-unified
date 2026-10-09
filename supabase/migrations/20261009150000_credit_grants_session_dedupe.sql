-- ADM-174 / PM-463 / RES-201 (PR #1718): grant one-time pack credits at most
-- once per Stripe Checkout Session, atomically in the database.
-- src/lib/provisioning.ts calls public.grant_pack_credits via rpc for
-- one-time packs with credits > 0. The dedupe row and the credit add commit
-- or roll back together, and the add is a single UPDATE ... SET x = x + n,
-- so concurrent checkouts for the same profile cannot lose an add.
-- NOT APPLIED by this PR. Apply before deploying #1718: without the function
-- the webhook fails closed (throws, Stripe retries) for credit packs.
-- Rollback:
--   DROP FUNCTION IF EXISTS public.grant_pack_credits(text, uuid, integer, text);
--   DROP TABLE IF EXISTS public.credit_grants;

CREATE TABLE IF NOT EXISTS public.credit_grants (
  stripe_session_id text        PRIMARY KEY,
  profile_id        uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan              text,
  credits           integer     NOT NULL CHECK (credits > 0),
  granted_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_grants_profile
  ON public.credit_grants (profile_id);

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (bypasses RLS) and the function below touch it.
REVOKE ALL ON TABLE public.credit_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.credit_grants TO service_role;

-- Returns true if this call granted the credits, false if the session was
-- already granted. Raises (and rolls back the dedupe row) on bad input or a
-- missing profile, so the caller fails closed and Stripe retries.
CREATE OR REPLACE FUNCTION public.grant_pack_credits(
  p_session_id text,
  p_profile_id uuid,
  p_credits    integer,
  p_plan       text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inserted integer;
  v_updated  integer;
BEGIN
  IF p_session_id IS NULL OR length(p_session_id) = 0 THEN
    RAISE EXCEPTION 'grant_pack_credits: session id required';
  END IF;
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'grant_pack_credits: profile id required';
  END IF;
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'grant_pack_credits: credits must be > 0 (got %)', p_credits;
  END IF;

  INSERT INTO public.credit_grants (stripe_session_id, profile_id, plan, credits)
  VALUES (p_session_id, p_profile_id, p_plan, p_credits)
  ON CONFLICT (stripe_session_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN false; -- this session already granted its credits
  END IF;

  UPDATE public.profiles
     SET generations_limit = generations_limit + p_credits
   WHERE id = p_profile_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 1 THEN
    -- Aborts the whole function call, including the credit_grants insert.
    RAISE EXCEPTION 'grant_pack_credits: profile % not found', p_profile_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_pack_credits(text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_pack_credits(text, uuid, integer, text) TO service_role;
