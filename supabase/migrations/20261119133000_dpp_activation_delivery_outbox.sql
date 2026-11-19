-- #2482: durable, PII-free DPP activation dispatch outbox.
-- Apply only through the reviewed production migration workflow. Nothing here
-- replays Stripe events, grants credit, sends mail, or changes customer data.
CREATE TABLE IF NOT EXISTS public.dpp_activation_outbox (
  session_id text PRIMARY KEY,
  profile_id text,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','leased','sending','accepted','needs_reconciliation')),
  claim_token uuid,
  lease_until timestamptz,
  send_attempts integer NOT NULL DEFAULT 0 CHECK (send_attempts >= 0),
  provider text,
  provider_http_status integer,
  provider_message_id text
    CHECK (provider_message_id IS NULL OR provider_message_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(session_id) BETWEEN 8 AND 255),
  CHECK (profile_id IS NULL OR length(profile_id) BETWEEN 1 AND 255)
);
CREATE INDEX IF NOT EXISTS dpp_activation_outbox_state_idx
  ON public.dpp_activation_outbox(state, lease_until);

ALTER TABLE public.dpp_activation_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dpp_activation_outbox FROM PUBLIC, anon, authenticated;
-- No table RLS policy, no anonymous access. All mutations require these
-- SECURITY DEFINER functions, each granted only to service_role.

-- Before any paid grant, record that this session's future activation has NOT
-- been attempted. Do not pre-create a marker for an already-succeeded legacy
-- action: its email may have been sent by older code.
CREATE OR REPLACE FUNCTION public.dpp_activation_prepare(
  p_session_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE v_row public.dpp_activation_outbox%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR length(p_session_id) NOT BETWEEN 8 AND 255 THEN
    RAISE EXCEPTION 'dpp_activation_invalid_session';
  END IF;
  INSERT INTO public.dpp_activation_outbox(session_id)
    VALUES (p_session_id) ON CONFLICT (session_id) DO NOTHING;
  SELECT * INTO STRICT v_row FROM public.dpp_activation_outbox
    WHERE session_id=p_session_id FOR UPDATE;
  RETURN jsonb_build_object('status',v_row.state);
END;
$body$;

CREATE OR REPLACE FUNCTION public.dpp_activation_enqueue(
  p_session_id text, p_profile_id text, p_is_demo boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE v_receipt_profile text; v_row public.dpp_activation_outbox%ROWTYPE;
BEGIN
  IF p_is_demo THEN RETURN jsonb_build_object('status','skipped_demo'); END IF;
  IF p_session_id IS NULL OR length(p_session_id) NOT BETWEEN 8 AND 255
     OR p_profile_id IS NULL OR length(btrim(p_profile_id)) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'dpp_activation_invalid_identity';
  END IF;
  -- A verified Stripe payment is checked by the webhook before this RPC.
  -- The DB additionally requires the durable session->profile grant receipt.
  SELECT profile_id INTO v_receipt_profile FROM public.founder_exit_side_effects
    WHERE idempotency_key = 'grant:' || p_session_id;
  IF NOT FOUND OR v_receipt_profile IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'dpp_activation_grant_receipt_mismatch';
  END IF;
  SELECT * INTO v_row FROM public.dpp_activation_outbox
    WHERE session_id=p_session_id FOR UPDATE;
  -- No marker = a legacy fulfilled action with UNKNOWN email outcome.
  -- Never bootstrap a new attempt after the fact.
  IF NOT FOUND THEN RETURN jsonb_build_object('status','legacy_untracked'); END IF;
  IF v_row.profile_id IS NULL THEN
    UPDATE public.dpp_activation_outbox
      SET profile_id=p_profile_id,updated_at=clock_timestamp()
      WHERE session_id=p_session_id;
  ELSIF v_row.profile_id IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'dpp_activation_profile_mismatch';
  END IF;
  RETURN jsonb_build_object('status',v_row.state);
END;
$body$;

CREATE OR REPLACE FUNCTION public.dpp_activation_claim(
  p_session_id text, p_profile_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE v_row public.dpp_activation_outbox%ROWTYPE; v_token uuid;
BEGIN
  SELECT * INTO v_row FROM public.dpp_activation_outbox
    WHERE session_id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_row.profile_id IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'dpp_activation_unknown_grant';
  END IF;
  IF v_row.state='accepted' THEN RETURN jsonb_build_object('status','accepted'); END IF;
  IF v_row.state='sending' AND v_row.lease_until <= clock_timestamp() THEN
    UPDATE public.dpp_activation_outbox
      SET state='needs_reconciliation', updated_at=clock_timestamp()
      WHERE session_id=p_session_id;
    RETURN jsonb_build_object('status','held');
  END IF;
  -- No automatic resend once a provider call may have started, even after
  -- process death or lease expiry. Manual reconciliation is required.
  IF v_row.state IN ('sending','needs_reconciliation') THEN
    RETURN jsonb_build_object('status','held');
  END IF;
  IF v_row.state='leased' AND v_row.lease_until > clock_timestamp() THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  -- Expired unarmed lease is safe to reclaim: no provider call could have begun.
  v_token := gen_random_uuid();
  UPDATE public.dpp_activation_outbox
    SET state='leased',claim_token=v_token,
        lease_until=clock_timestamp()+interval '5 minutes',
        updated_at=clock_timestamp()
    WHERE session_id=p_session_id;
  RETURN jsonb_build_object('status','claimed','claim_token',v_token);
END;
$body$;

CREATE OR REPLACE FUNCTION public.dpp_activation_begin_send(
  p_session_id text, p_claim_token uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE v_updated integer;
BEGIN
  -- Durable pre-send transition: a crash after here is AMBIGUOUS and held.
  UPDATE public.dpp_activation_outbox
    SET state='sending',send_attempts=send_attempts+1,
        updated_at=clock_timestamp()
    WHERE session_id=p_session_id AND claim_token=p_claim_token
      AND state='leased' AND lease_until > clock_timestamp();
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>1 THEN RAISE EXCEPTION 'dpp_activation_send_lease_lost'; END IF;
  RETURN jsonb_build_object('status','armed');
END;
$body$;

CREATE OR REPLACE FUNCTION public.dpp_activation_finish_send(
  p_session_id text, p_claim_token uuid, p_accepted boolean,
  p_provider text DEFAULT NULL, p_http_status integer DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE v_updated integer; v_final text;
BEGIN
  -- Uncertain failure is held, NEVER automatically retried. No email, API
  -- payload, provider error body, or recipient identifier is persisted.
  v_final := CASE WHEN p_accepted IS TRUE
    THEN 'accepted' ELSE 'needs_reconciliation' END;
  UPDATE public.dpp_activation_outbox
    SET state=v_final, provider=left(p_provider,32),
        provider_http_status=p_http_status,
        provider_message_id=left(p_provider_message_id,128),
        updated_at=clock_timestamp()
    WHERE session_id=p_session_id AND claim_token=p_claim_token AND state='sending';
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>1 THEN RAISE EXCEPTION 'dpp_activation_completion_state_changed'; END IF;
  RETURN jsonb_build_object('status',v_final);
END;
$body$;

REVOKE ALL ON FUNCTION public.dpp_activation_prepare(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dpp_activation_enqueue(text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dpp_activation_claim(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dpp_activation_begin_send(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dpp_activation_finish_send(text,uuid,boolean,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dpp_activation_prepare(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dpp_activation_enqueue(text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.dpp_activation_claim(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dpp_activation_begin_send(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dpp_activation_finish_send(text,uuid,boolean,text,integer,text) TO service_role;
