-- Recovered from production. This is a record, not a change.
--
-- These seven functions are live in the production database (project QRON-v2,
-- nhdnkzhtadfkkluiulhs) but had no migration in this repository. Each body below
-- is the exact output of pg_get_functiondef read on 2026-10-22. The md5 in each
-- BEGIN marker is the md5 of that text; scripts/lib/recovered-verify-family-sql.test.js
-- checks the file against hard-coded copies of the same values.
--
-- Applying this file to production changes nothing: CREATE OR REPLACE with an
-- identical body keeps the existing owner and privileges. It carries no GRANT and
-- no REVOKE on purpose, so it neither widens nor narrows access.
--
-- Live privileges at read time: PUBLIC execute on verify_asset, resolve_asset,
-- score_asset, get_asset_provenance and get_public_verification, so anon and
-- authenticated can call them (checkpoint CP-B1). The proposed revoke for
-- verify_asset is in docs/execution/CHECKPOINT_2026-10-22_security-and-ci.md,
-- section 4, and is a separate founder action.
--
-- Two limits. A database built fresh from migrations gives new functions the
-- platform default privileges, not the live ones, so state the intended privileges
-- in their own migration. And the LANGUAGE sql bodies are checked at creation, so
-- the tables they read (for example product_events and supply_chain_events) must
-- already exist; they do in production.
--
-- To compare a database with this file, run the query below and match the md5
-- column to the BEGIN markers:
--   select p.oid::regprocedure::text as sig, md5(pg_get_functiondef(p.oid)) as md5
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('get_asset_provenance', 'get_public_verification', 'increment_portal_scan', 'normalize_asset_ref', 'resolve_asset', 'score_asset', 'verify_asset')
--    order by 1;

-- BEGIN normalize_asset_ref(text) md5:a6551186fa3d7c51b2a7579de22f7494
CREATE OR REPLACE FUNCTION public.normalize_asset_ref(p_ref text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v text;
begin
  v := btrim(coalesce(p_ref, ''));
  if v = '' then
    return null;
  end if;

  v := split_part(split_part(v, '?', 1), '#', 1);

  if v ~* '^https?://' then
    v := regexp_replace(v, '/+$', '');
    v := (regexp_split_to_array(v, '/'))[array_length(regexp_split_to_array(v, '/'), 1)];
  end if;

  return btrim(v);
end;
$function$
;
-- END normalize_asset_ref(text)

-- BEGIN get_asset_provenance(uuid,text) md5:86e90297704e78915f9dcd0a76aa0812
CREATE OR REPLACE FUNCTION public.get_asset_provenance(p_product_id uuid, p_cert_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(e order by e->>'occurred_at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'source','registry','event_type',pe.event_type,'actor',pe.actor,
      'location',pe.location,'occurred_at',coalesce(pe.occurred_at, pe.created_at),
      'blockchain_tx',pe.blockchain_tx,'verified',coalesce(pe.verified,false)) as e
      from public.product_events pe
     where (p_product_id is not null and pe.product_id = p_product_id)
        or (p_cert_id is not null and pe.cert_id = p_cert_id)
    union all
    select jsonb_build_object(
      'source','supply_chain','event_type',sc.event_type,'actor',coalesce(sc.actor, sc.actor_name),
      'location',sc.location,'occurred_at',coalesce(sc."timestamp", sc.created_at),
      'blockchain_tx',coalesce(sc.blockchain_tx, sc.tx_hash),'verified',coalesce(sc.verified,false)) as e
      from public.supply_chain_events sc
     where p_product_id is not null and sc.product_id = p_product_id
  ) s;
$function$
;
-- END get_asset_provenance(uuid,text)

-- BEGIN get_public_verification(text) md5:b68538d3324ea7c8f10ed2f4b58b29a8
CREATE OR REPLACE FUNCTION public.get_public_verification(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'slug', v.public_slug,
    'asset_ref', v.asset_ref,
    'asset_kind', v.asset_kind,
    'brand', v.brand,
    'product_name', v.product_name,
    'cert_id', v.cert_id,
    'authenticity_score', v.score,
    'verdict', v.verdict,
    'confidence', v.confidence,
    'consensus', v.agent_votes,
    'signals', v.signals,
    'provenance', v.provenance,
    'blockchain', jsonb_build_object('network', case when v.polygon_tx is not null then 'polygon' end, 'tx_hash', v.polygon_tx),
    'verified_at', v.verified_at,
    'total_verifications', (select count(*) from public.verifications x where x.asset_ref = v.asset_ref))
  from public.verifications v where v.public_slug = p_slug limit 1;
$function$
;
-- END get_public_verification(text)

-- BEGIN increment_portal_scan(text) md5:571b89f262edb1679e4f3af9c963f159
CREATE OR REPLACE FUNCTION public.increment_portal_scan(sc text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.portals
  set scan_count = scan_count + 1,
      updated_at = now()
  where shortcode = sc
    and active = true;
$function$
;
-- END increment_portal_scan(text)

-- BEGIN resolve_asset(text) md5:0a5ec032ccbcaffef49c3ab5c6239f67
CREATE OR REPLACE FUNCTION public.resolve_asset(p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ref text; out jsonb; r record;
begin
  ref := public.normalize_asset_ref(p_ref);
  if ref is null then
    return jsonb_build_object('found', false, 'reason', 'empty_reference');
  end if;

  -- 1. AuthiChain certificate registry (primary source of truth)
  select * into r from public.authichain_certificates
   where cert_id = ref or product_id = ref or sku = ref
   order by issued_at desc nulls last limit 1;
  if found then
    out := jsonb_build_object(
      'found', true, 'kind', 'certificate', 'ref', ref,
      'cert_id', r.cert_id, 'product_ref', r.product_id, 'brand', r.brand,
      'product_name', r.product_name, 'sku', r.sku, 'product_hash', r.product_hash,
      'issued_at', r.issued_at, 'revoked_at', r.revoked_at, 'valid', coalesce(r.valid, true),
      'scan_count', coalesce(r.scan_count, 0), 'metadata', coalesce(r.metadata, '{}'::jsonb));
  end if;

  -- 2. Blockchain cert record (adds polygon/NFT anchoring)
  if out is null or (out->>'found')::boolean then
    select * into r from public.certs where cert_id = ref limit 1;
    if found then
      if out is null then
        out := jsonb_build_object('found', true, 'kind', 'certificate', 'ref', ref,
          'cert_id', r.cert_id, 'product_name', r.product_name, 'brand', r.manufacturer,
          'valid', true, 'metadata', coalesce(r.metadata, '{}'::jsonb));
      end if;
      out := out || jsonb_build_object(
        'polygon_tx', r.polygon_tx_hash, 'polygon_contract', r.polygon_contract,
        'nft_token_id', r.nft_token_id, 'batch_id', r.batch_id);
    end if;
  end if;

  -- 3. Product registry (TrueMark ID / SKU / UUID)
  if out is null then
    select * into r from public.products
     where truemark_id = ref or sku = ref
        or (ref ~ '^[0-9a-fA-F]{8}-' and id = ref::uuid)
     order by created_at desc nulls last limit 1;
    if found then
      out := jsonb_build_object(
        'found', true, 'kind', 'product', 'ref', ref,
        'product_id', r.id, 'product_ref', r.id::text, 'brand', r.brand,
        'product_name', r.name, 'sku', r.sku, 'category', r.category,
        'image_url', r.image_url, 'truemark_id', r.truemark_id,
        'polygon_tx', r.blockchain_tx_hash, 'nft_token_id', r.nft_token_id,
        'counterfeit_reports', coalesce(r.counterfeit_reports, 0),
        'registered', coalesce(r.is_registered, false), 'valid', true);
    end if;
  end if;

  -- 4. Physical seal fallback
  if out is null then
    select * into r from public.auth_seals
     where product_id = ref or batch_id = ref or qr_payload = ref
     order by created_at desc nulls last limit 1;
    if found then
      out := jsonb_build_object('found', true, 'kind', 'seal', 'ref', ref,
        'product_ref', r.product_id, 'brand', r.brand, 'batch_id', r.batch_id,
        'polygon_tx', r.polygon_tx, 'valid', true);
    end if;
  end if;

  if out is null then
    return jsonb_build_object('found', false, 'ref', ref, 'reason', 'not_in_registry');
  end if;

  -- attach canonical product uuid when the cert points at one
  if (out->>'product_id') is null and (out->>'product_ref') ~ '^[0-9a-fA-F]{8}-' then
    out := out || jsonb_build_object('product_id', (out->>'product_ref')::uuid);
  end if;
  return out;
end $function$
;
-- END resolve_asset(text)

-- BEGIN score_asset(jsonb,jsonb) md5:d722387375399be7443256181a069a2b
CREATE OR REPLACE FUNCTION public.score_asset(p_asset jsonb, p_provenance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  guardian numeric := 0; sentinel numeric := 0; archivist numeric := 0;
  arbiter  numeric := 0; scout    numeric := 0;
  g_note text; s_note text; a_note text; ar_note text; sc_note text;
  ev_total int := 0; ev_verified int := 0; ev_anchored int := 0;
  reports int := 0; scans int := 0; open_alerts int := 0; max_risk numeric := 0;
  age_days numeric := 0; score numeric; verdict text; agents jsonb;
begin
  if not coalesce((p_asset->>'found')::boolean, false) then
    return jsonb_build_object(
      'score', 4, 'verdict', 'unregistered', 'confidence', 'high',
      'agents', jsonb_build_array(jsonb_build_object(
        'agent','guardian','weight',0.35,'verdict','fail','confidence',0.97,
        'reasoning','Reference resolves to no record in the AuthiChain registry.')),
      'dissenting', '[]'::jsonb);
  end if;

  ev_total    := coalesce(jsonb_array_length(p_provenance), 0);
  select count(*) filter (where (e->>'verified')::boolean),
         count(*) filter (where coalesce(e->>'blockchain_tx','') <> '')
    into ev_verified, ev_anchored
    from jsonb_array_elements(coalesce(p_provenance,'[]'::jsonb)) e;

  reports := coalesce((p_asset->>'counterfeit_reports')::int, 0);
  scans   := coalesce((p_asset->>'scan_count')::int, 0);
  age_days := greatest(1, extract(epoch from (now() - coalesce((p_asset->>'issued_at')::timestamptz, now() - interval '30 days'))) / 86400.0);

  select count(*) filter (where coalesce(status,'open') <> 'dismissed'), coalesce(max(risk_score),0)
    into open_alerts, max_risk
    from public.scout_alerts
   where (p_asset->>'cert_id' is not null and cert_id = p_asset->>'cert_id')
      or (p_asset->>'product_id' is not null and product_id = (p_asset->>'product_id')::uuid);

  -- GUARDIAN 35%: registry integrity
  if coalesce((p_asset->>'valid')::boolean, true) and (p_asset->>'revoked_at') is null then
    guardian := 0.80;
    if coalesce(p_asset->>'product_hash','') <> '' then guardian := guardian + 0.10; end if;
    if coalesce(p_asset->>'polygon_tx','') <> ''    then guardian := guardian + 0.10; end if;
    g_note := 'Registry record present and unrevoked'
              || case when coalesce(p_asset->>'polygon_tx','') <> '' then '; anchored on Polygon.' else '; no on-chain anchor.' end;
  else
    guardian := 0.05;
    g_note := 'Certificate is revoked or marked invalid in the registry.';
  end if;

  -- SENTINEL 25%: anomaly / abuse signals
  sentinel := 1.0;
  if reports > 0 then sentinel := sentinel - least(0.6, reports * 0.20); end if;
  if scans / age_days > 50 then sentinel := sentinel - 0.25; end if;
  if open_alerts > 0 then sentinel := sentinel - least(0.3, open_alerts * 0.10); end if;
  sentinel := greatest(0, sentinel);
  s_note := format('%s counterfeit report(s), %s scan(s) over %s day(s), %s open marketplace alert(s).',
                   reports, scans, round(age_days), open_alerts);

  -- ARCHIVIST 20%: provenance depth and anchoring
  archivist := least(1.0, ev_total * 0.18)
             + case when ev_verified > 0 then 0.20 else 0 end
             + case when ev_anchored > 0 then 0.20 else 0 end;
  archivist := least(1.0, archivist);
  a_note := format('%s provenance event(s); %s verified, %s blockchain-anchored.', ev_total, ev_verified, ev_anchored);

  -- ARBITER 12%: cross-record consistency
  arbiter := 0.40;
  if coalesce(p_asset->>'brand','')        <> '' then arbiter := arbiter + 0.20; end if;
  if coalesce(p_asset->>'product_name','') <> '' then arbiter := arbiter + 0.20; end if;
  if coalesce(p_asset->>'sku','')          <> '' then arbiter := arbiter + 0.10; end if;
  if coalesce(p_asset->>'product_id','')   <> '' then arbiter := arbiter + 0.10; end if;
  arbiter := least(1.0, arbiter);
  ar_note := 'Identity fields cross-checked across certificate, product and seal records.';

  -- SCOUT 8%: external marketplace risk
  scout := greatest(0, 1.0 - (max_risk / 100.0) - (open_alerts * 0.15));
  sc_note := case when open_alerts = 0 then 'No suspicious third-party listings detected.'
                  else format('%s flagged listing(s), peak risk %s/100.', open_alerts, round(max_risk)) end;

  score := round((guardian*0.35 + sentinel*0.25 + archivist*0.20 + arbiter*0.12 + scout*0.08) * 100, 1);

  verdict := case when score >= 85 then 'authentic'
                  when score >= 65 then 'likely_authentic'
                  when score >= 40 then 'inconclusive'
                  else 'suspicious' end;

  agents := jsonb_build_array(
    jsonb_build_object('agent','guardian', 'weight',0.35,'confidence',round(guardian,3), 'verdict', case when guardian>=0.6 then 'pass' else 'fail' end,'reasoning',g_note),
    jsonb_build_object('agent','sentinel', 'weight',0.25,'confidence',round(sentinel,3), 'verdict', case when sentinel>=0.6 then 'pass' else 'fail' end,'reasoning',s_note),
    jsonb_build_object('agent','archivist','weight',0.20,'confidence',round(archivist,3),'verdict', case when archivist>=0.6 then 'pass' else 'fail' end,'reasoning',a_note),
    jsonb_build_object('agent','arbiter',  'weight',0.12,'confidence',round(arbiter,3),  'verdict', case when arbiter>=0.6 then 'pass' else 'fail' end,'reasoning',ar_note),
    jsonb_build_object('agent','scout',    'weight',0.08,'confidence',round(scout,3),    'verdict', case when scout>=0.6 then 'pass' else 'fail' end,'reasoning',sc_note));

  return jsonb_build_object(
    'score', score,
    'verdict', verdict,
    'confidence', case when score >= 85 or score < 40 then 'high' when score >= 65 then 'medium' else 'low' end,
    'agents', agents,
    'dissenting', coalesce((select jsonb_agg(a->>'agent') from jsonb_array_elements(agents) a
                             where (a->>'verdict') <> case when verdict in ('authentic','likely_authentic') then 'pass' else 'fail' end), '[]'::jsonb),
    'signals', jsonb_build_object('events_total',ev_total,'events_verified',ev_verified,
                 'events_anchored',ev_anchored,'counterfeit_reports',reports,
                 'scan_count',scans,'open_alerts',open_alerts,'age_days',round(age_days)));
end $function$
;
-- END score_asset(jsonb,jsonb)

-- BEGIN verify_asset(text,uuid,jsonb) md5:2cd18f31ae5d0ec70785b2b0e6ea07f4
CREATE OR REPLACE FUNCTION public.verify_asset(p_ref text, p_api_key_id uuid DEFAULT NULL::uuid, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t0 timestamptz := clock_timestamp();
  asset jsonb; prov jsonb; verdictdoc jsonb;
  v_id uuid; v_slug text; pid uuid; cert text; a jsonb;
begin
  asset := public.resolve_asset(p_ref);
  pid   := nullif(asset->>'product_id','')::uuid;
  cert  := nullif(asset->>'cert_id','');
  prov  := case when coalesce((asset->>'found')::boolean,false)
                then public.get_asset_provenance(pid, cert) else '[]'::jsonb end;
  verdictdoc := public.score_asset(asset, prov);

  insert into public.verifications (
    product_id, truemark_id, cert_id, raw_input, asset_ref, asset_kind,
    result, verdict, score, trust_score, confidence, signals, agent_votes, provenance,
    polygon_tx, brand, product_name, api_key_id,
    ip_address, user_agent, country, latency_ms
  ) values (
    pid, nullif(asset->>'truemark_id',''), cert, p_ref,
    coalesce(asset->>'ref', public.normalize_asset_ref(p_ref)), coalesce(asset->>'kind','unknown'),
    verdictdoc->>'verdict', verdictdoc->>'verdict',
    (verdictdoc->>'score')::numeric, round((verdictdoc->>'score')::numeric)::int,
    verdictdoc->>'confidence', verdictdoc->'signals', verdictdoc->'agents', prov,
    nullif(asset->>'polygon_tx',''), nullif(asset->>'brand',''), nullif(asset->>'product_name',''),
    p_api_key_id,
    nullif(p_context->>'ip',''), nullif(p_context->>'user_agent',''), nullif(p_context->>'country',''),
    (extract(epoch from (clock_timestamp()-t0))*1000)::int
  ) returning id, public_slug into v_id, v_slug;

  -- audit trail: individual agent claims + the consensus row
  for a in select * from jsonb_array_elements(verdictdoc->'agents') loop
    begin
      insert into public.agent_claims (product_id, cert_id, scan_id, agent, verdict, confidence, weight, reasoning, signals)
      values (pid, cert, v_id, a->>'agent', a->>'verdict',
              (a->>'confidence')::numeric, (a->>'weight')::numeric, a->>'reasoning', verdictdoc->'signals');
    exception when others then null; end;
  end loop;

  begin
    insert into public.agent_consensus (product_id, cert_id, scan_id, final_verdict, trust_score,
                                        weighted_confidence, agent_votes, dissenting_agents, polygon_tx, resolved_at)
    values (pid, cert, v_id, verdictdoc->>'verdict', (verdictdoc->>'score')::numeric,
            (verdictdoc->>'score')::numeric/100, verdictdoc->'agents', verdictdoc->'dissenting',
            nullif(asset->>'polygon_tx',''), now());
  exception when others then null; end;

  -- keep the certificate's scan telemetry live
  if cert is not null then
    begin
      update public.authichain_certificates
         set scan_count = coalesce(scan_count,0)+1, last_scanned = now()
       where cert_id = cert;
    exception when others then null; end;
  end if;

  -- meter the call against the caller's quota
  if p_api_key_id is not null then
    begin
      insert into public.verification_usage (api_key_id, price_cents, occurred_at)
      values (p_api_key_id, 1, now());
    exception when others then null; end;
  end if;

  return jsonb_build_object(
    'verification_id', v_id,
    'asset', asset - 'metadata',
    'authenticity_score', (verdictdoc->>'score')::numeric,
    'verdict', verdictdoc->>'verdict',
    'confidence', verdictdoc->>'confidence',
    'consensus', jsonb_build_object('agents', verdictdoc->'agents', 'dissenting', verdictdoc->'dissenting'),
    'signals', verdictdoc->'signals',
    'provenance', prov,
    'blockchain', jsonb_build_object(
        'network', case when coalesce(asset->>'polygon_tx','') <> '' then 'polygon' else null end,
        'tx_hash', nullif(asset->>'polygon_tx',''),
        'contract', nullif(asset->>'polygon_contract',''),
        'token_id', nullif(asset->>'nft_token_id','')),
    'public_url', 'https://authichain.com/v/' || v_slug,
    'slug', v_slug,
    'verified_at', now(),
    'latency_ms', (extract(epoch from (clock_timestamp()-t0))*1000)::int);
end $function$
;
-- END verify_asset(text,uuid,jsonb)
