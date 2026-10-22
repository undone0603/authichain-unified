# Ledger checkpoint 2026-10-22 (2): security review and CI evidence

Written by the Claude Sonnet 5.5 execution session. IDs prefixed CP- are local to this checkpoint and are renumbered when folded into BLOCKERS and NEXT_ACTIONS. Evidence date 2026-10-22; Supabase advisor observed_at 2026-10-22T18:04:06Z.

This is a new file on purpose. GitHub PR #1995 carries newer versions of BLOCKERS, CI_STATUS, NEXT_ACTIONS, VERIFICATION_EVIDENCE and four docs that are not on main. Editing those files here would create conflicting changes in that PR. When #1995 lands, fold the entries below into the numbered files and keep this one as the dated record.

## Checkpoint

| Field | Value |
| ----- | ----- |
| CURRENT BRANCH | main (GitLab and GitHub both at 1b40ceb4) |
| CURRENT COMMIT | work branch fix/checkout-closed-plan-hold at dc10d43b (MR !2001, not merged) |
| LAST SUCCESSFUL PIPELINE | 2977807218 on dc10d43b, all 5 jobs success |
| CURRENT TASK | P0 review of the production database (issue #1735), then ledger sync |
| COMPLETED | !2001 red-to-green fix; read-only Supabase security review; edge function inventory; stripe-webhook signature check (static) |
| IN PROGRESS | recovering unversioned production SQL and edge function source into the repo |
| FAILED | none this checkpoint; pipeline 2977607114 on 5c00c46e failed before the fix and is explained below |
| BLOCKED | owner decisions CP-B1 to CP-B3; Stripe sandbox E2E (N-4) needs sandbox keys through an approved channel; Cloudflare MCP 410 |
| NEXT ACTION | owner reviews CP-B1; then recover verify-family SQL as a migration whose body is compared by md5 to the live definition |

## 1. MR !2001 (close monthly Launch deterministically)

ACTION: found why !2001 was red, reproduced it, fixed it, pushed to the MR branch.
RESULT: green. Pipeline 2977807218, commit dc10d43b.

| Job | Id | Status | Duration |
| --- | -- | ------ | -------- |
| static_checks | 17392450607 | success | 16s |
| node_test_runner_coverage | 17392450616 | success | 16s |
| secret_scan_gate | 17392450618 | success | 22s |
| quality_gate | 17392450619 | success | 452s |
| build_gate | 17392450620 | success | 348s |

Cause: after the QRON interdiction gate left the POST path, the confirm page still rendered a required 'QRON attestation token' input for both Launch plans. A POST built from the rendered fields passed, but a browser will not submit a required field left empty, so a real buyer could not check out. The old tests posted a hand-built field set and stayed green.

Fix (checkout-gate.ts, checkout-gate.test.ts, checkout-gate.closed-plans.test.ts): removed the attestation input and the carry-through of qron_attestation, removed the metadata write, replaced the obsolete gate tests, and added tests that read the rendered form: email is the only required field, no attestation field is shown even when the link carries one, and a client-supplied qron_attestation never reaches Stripe metadata. The HMAC verifier is kept and is not called by checkout, pending the owner decision recorded as B-1 option c.

Evidence: full local suite 186 files, 1689 passed, 1 skipped; eslint clean on touched files; scoped tsc 0 errors in touched files; mutation check done. Pipeline 2977607114 (5c00c46e, failed) is the pre-fix state. Other pipelines read this session: 2977671914 success on MR !2003 (faafca4e); 2976381736 success on verify/quality-gates-on-stale-test-fixes (2f6c7017, 379s).

Economic gates untouched: humanHold, production_send=false, Stripe webhook verification, fulfillDppPaidSession and purchase provisioning are not modified by this change. Nothing merged. Merging to main may trigger a production deploy; that is the owner's call.

## 2. Production database review (issue #1735), read-only

Project QRON-v2 (nhdnkzhtadfkkluiulhs). Method: Supabase security advisor, catalog SELECTs (pg_proc, pg_class, has_function_privilege), applied-migration list, edge function list, API logs for the last 24 hours. No DDL, no DML, no function calls, no setting changes.

Advisor totals: 164 rls_enabled_no_policy (INFO); 2 security_definer_view (ERROR); 10 SECURITY DEFINER functions executable by anon and the same 10 by authenticated (WARN); 1 function_search_path_mutable; 2 extension_in_public (vector, pg_net); leaked password protection disabled.

| Item | Evidence | Class | Proposed handling |
| ---- | -------- | ----- | ----------------- |
| verify_asset(text, uuid, jsonb) | SECURITY DEFINER; has_function_privilege true for anon and authenticated (PUBLIC grant). Body inserts into verifications, agent_claims, agent_consensus, bumps authichain_certificates.scan_count and last_scanned, and inserts verification_usage rows for the caller-supplied p_api_key_id with no validation. Inner failures are swallowed (exception when others then null). | P0, data integrity. Exploitability not tested (writing to production was out of bounds). | Revoke from public, anon, authenticated; keep service_role. See CP-B1 and the SQL below. |
| resolve_asset, score_asset, get_asset_provenance, get_public_verification | SECURITY DEFINER, PUBLIC execute. Read-only lookups, probably the intended public verification surface. | P1 provenance gap (unversioned), no exposure change proposed. | Recover SQL into the repo (CP-N1). Do not revoke without a caller map. |
| increment_portal_scan(text) | PUBLIC execute; anyone can bump scan_count of any active portal shortcode. | Low, counter integrity. | Owner decides: service_role only, or accept. |
| is_email_suppressed, authichain_api_resolve_key, growth_record_event | anon-executable by documented design (migration comments in 20261003021901 and 20261003021902). API logs show growth_record_event is live traffic (39 of 71 requests in the last 24h). | Accepted risk, residual spam and oracle exposure. growth_record_event feeds the 14 and 30 day kill windows, so injected events can distort them. | Keep. Move to service_role when workers/authichain-api has its service-role binding, as the migration says. |
| gov_opportunities_public, gov_proposals_public | security_invoker=false on purpose (migration 20261015061249 restores definer semantics). anon has SELECT only (writes revoked by 20261010180000). The opportunities view exposes status, fit_score, estimated_value and description for new, scored, qualified and proposal_drafted rows. | Accepted by design; linter ERROR remains. | Owner confirms those columns are meant to be public (CP-B3). |
| 164 tables with RLS and no policy | Deny-all for API roles; service role bypasses. On the five tables whose ACLs were read (verifications, white_label_clients, growth_loop_events, portals, email_suppressions) anon still holds broad table privileges, so RLS is the only barrier. | Informational. | Defense in depth: per-table privilege review, not a blanket revoke. |
| founder_exit_actions_guard | Trigger function, not SECURITY DEFINER, search_path not pinned. | Low. | alter function ... set search_path in a reviewed migration. |
| vector, pg_net in public | Extension schema. | Low. | Defer; moving them can break dependents. |
| Leaked password protection off | Supabase Auth setting. | Low. | Owner toggles it in the dashboard; not changed by this session. |

Traffic check, last 24h of edge logs (71 requests): 0 calls to rpc/verify_asset, rpc/increment_portal_scan, rpc/resolve_asset or rpc/get_public_verification. Data check: verifications has 7 rows, none with an api_key_id, and verification_usage has 0 rows, so no metered use is recorded. The log check covers a short window; it supports 'low use today', not 'no caller exists'.

## 3. Production code that is not in version control

Database: no CREATE FUNCTION exists in supabase/ or docs/ for verify_asset, resolve_asset, score_asset, get_asset_provenance, get_public_verification or increment_portal_scan. docs/ESTATE-RECOVERY-2026-10-06.md already records that the SQL for the first five was never recovered. The live definitions can be read with pg_get_functiondef.

Edge functions: the project lists at least 82 deployed functions; supabase/functions holds 23 and all 23 are deployed, so 59 deployed functions have no source in the repo. Payment and verification adjacent among them: stripe-webhook, stripe-setup, stripe-worker, qron-checkout, storefront-checkout, validate-api-key, authichain-subscription, authichain-verify, authichain-verify-page, authichain-webhooks-outbound, qron-rewards. All but authichain-products and zapier-webhook have verify_jwt=false; each one needs its own authentication check, which this session did not assess.

stripe-webhook (v36), signature check, static reading only: the deployed bundle is the Supabase stripe-sync-engine template (1.08 MB index.ts). The handler rejects non-POST with 405 and a missing stripe-signature header with 400. StripeSync.processWebhook requires a webhook secret (configured, or read from the _managed_webhooks table), throws if none is found, and calls constructEventAsync(payload, signature, secret) before any event is processed. Signature errors return 400. No forged-signature request was sent to production. Scope of this check is signature verification only.

authichain-verify (v21), static finding, not tested: it takes the last path segment of the request URL and interpolates it unencoded into PostgREST query strings that carry the service-role key (truemark_id=eq. followed by the raw segment). A segment containing '&' could add filter parameters and widen what the service role returns past RLS. Fix is encodeURIComponent on the segment. Reproduce locally against a stub before changing production.

## 4. Proposed SQL for the owner (NOT APPLIED)

Applying this changes database privileges, which this session does not do. Issue #1735 asks for reviewed migrations and no blanket revokes. Run it only after CP-B1 is answered.

    -- PROPOSED. NOT APPLIED.
    begin;
    revoke all on function public.verify_asset(text, uuid, jsonb) from public, anon, authenticated;
    grant execute on function public.verify_asset(text, uuid, jsonb) to service_role;
    commit;
    -- Rollback, if a caller breaks:
    -- grant execute on function public.verify_asset(text, uuid, jsonb) to public, anon, authenticated;

verify_asset calls resolve_asset, get_asset_provenance and score_asset inside its own definer context, so this revoke does not break those three for other callers and does not need them changed.

## 5. Blockers

BLOCKER: CP-B1 verify_asset is anonymously callable and writes data.
WHY: PUBLIC execute on a SECURITY DEFINER writer with a caller-chosen api_key_id.
EVIDENCE: section 2; has_function_privilege check; function body; 24h logs show no calls; table counts 7 and 0.
WHAT I CAN DO WITHOUT IT: recover the function SQL into a reviewed migration file and a regression test of the grant; nothing that changes privileges.
EXACT EXTERNAL DEPENDENCY: owner confirms no external caller (authichain-verify GitLab project, RapidAPI, partners) uses verify_asset with the anon key, then approves the SQL in section 4.
NEXT ACTION: owner answers; I prepare the migration PR.

BLOCKER: CP-B2 Cloudflare MCP failed to connect (410) this session.
WHY: Workers Builds and deploy status for main (B-5, B-6) cannot be read from here.
EVIDENCE: connection error reported by the tool host.
WHAT I CAN DO WITHOUT IT: everything repo-side; GitLab deploy jobs stay inert without CLOUDFLARE_* variables.
EXACT EXTERNAL DEPENDENCY: reconnect the Cloudflare connector, or the owner reads the build status.
NEXT ACTION: retry the connection next session.

BLOCKER: CP-B3 confirm the public columns on gov_opportunities_public.
WHY: status, fit_score and estimated_value show which opportunities are being pursued.
EVIDENCE: view definition read from the catalog; anon SELECT granted.
WHAT I CAN DO WITHOUT IT: nothing safe; this is a product decision.
EXACT EXTERNAL DEPENDENCY: owner decision.
NEXT ACTION: owner answers; I narrow the view in a migration if asked.

## 6. Next actions

1. Owner: review MR !2001 and decide the merge and its timing (a merge to main can deploy).
2. Owner: answer CP-B1, CP-B3; toggle leaked password protection if wanted.
3. CP-N1 Recover verify_asset, resolve_asset, score_asset, get_asset_provenance, get_public_verification, increment_portal_scan into a migration. Verify by comparing md5 of the live pg_get_functiondef output with the file; no apply.
4. CP-N2 Export the 59 unversioned edge functions into supabase/functions, starting with stripe-webhook, qron-checkout, storefront-checkout, validate-api-key and authichain-verify. Needs a supabase CLI download or per-function reads; stripe-webhook is a 1 MB bundle, so export it as the deployed artifact and note the upstream template.
5. CP-N3 Local reproduction of the authichain-verify path-segment issue against a stub.
6. Review MR !2003 (dogfood release attestation binding, N-3): run its tests locally and its negative cases, record in VERIFICATION_EVIDENCE.
7. Stripe sandbox E2E (N-4) once sandbox keys are provided through an approved channel. Sandbox only.
8. Fold this checkpoint into the numbered ledger files after PR #1995 lands.
