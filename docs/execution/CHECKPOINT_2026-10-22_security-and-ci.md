# Ledger checkpoint 2026-10-22 (2): security review and CI evidence

Written by the Claude Sonnet 5.5 execution session. IDs prefixed CP- are local to this checkpoint and are renumbered when folded into BLOCKERS and NEXT_ACTIONS. Evidence date 2026-10-22; Supabase advisor observed_at 2026-10-22T18:04:06Z.

This is a new file on purpose. GitHub PR #1995 carries newer versions of BLOCKERS, CI_STATUS, NEXT_ACTIONS, VERIFICATION_EVIDENCE and four docs that are not on main. Editing those files here would create conflicting changes in that PR. When #1995 lands, fold the entries below into the numbered files and keep this one as the dated record.

## Checkpoint

| Field | Value |
| ----- | ----- |
| CURRENT BRANCH | main (GitLab and GitHub both at 1b40ceb4) |
| CURRENT COMMIT | work branch fix/checkout-closed-plan-hold at 22936e2c (MR !2001, not merged); adds the opt-in stripe-mock contract test on top of dc10d43b |
| LAST SUCCESSFUL PIPELINE | 2977807218 on dc10d43b, all 5 jobs success; 2977904507 on 22936e2c was still running when this was written |
| CURRENT TASK | P0 review of the production database (issue #1735), then ledger sync |
| COMPLETED | !2001 red-to-green fix; read-only Supabase security review; edge function inventory; stripe-webhook signature check (static); MR !2003 review |
| IN PROGRESS | recovering unversioned production SQL and edge function source into the repo |
| FAILED | none this checkpoint; pipeline 2977607114 on 5c00c46e failed before the fix and is explained below |
| BLOCKED | founder-override actions CP-B1 (DB revoke) and CP-B5 (humanHold, production_send), each a single prepared action; CP-B3 and CP-B4 are decisions; merges of !2001, !2003, !2005 were refused by the session permission check (see 8.3); real Stripe sandbox E2E (N-4) needs sandbox keys through an approved channel |
| DIRECTION | founder direction 2026-10-22: autonomous company, founder override and kill switch are the only gates. This record adds no review gates; it only makes each founder action one step |
| NEXT ACTION | founder runs the section 4 SQL (evidence in 8.1) and merges the green MRs; session continues with the DB-function recovery migration |

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
EVIDENCE: section 2; has_function_privilege check; function body; edge logs show zero REST calls naming verify_asset in three consecutive 24h windows (2026-10-19 to 2026-10-22) while the latest window holds 38 other /rpc/ calls, so the search does see RPC traffic; no caller anywhere in the repo; table counts 7 and 0. Limit: a caller that runs less often than every three days, or that reaches Postgres without REST, would not show.
WHAT I CAN DO WITHOUT IT: recover the function SQL into a migration file with an md5 check; nothing that changes privileges.
EXACT EXTERNAL DEPENDENCY: the founder runs the section 4 SQL. It is one paste with a one-line rollback. This session does not change production access controls.
NEXT ACTION: founder pastes section 4; session re-reads has_function_privilege afterwards if asked.

RESOLVED: CP-B2 Cloudflare MCP failed to connect (410) early in this session. It connected later and the deployed Stripe-related workers were read (section 8.2). The connector dropped with a 410 again at the end, so Workers Builds status for main (B-5, B-6) is still unread.

BLOCKER: CP-B3 confirm the public columns on gov_opportunities_public.
WHY: status, fit_score and estimated_value show which opportunities are being pursued.
EVIDENCE: view definition read from the catalog; anon SELECT granted.
WHAT I CAN DO WITHOUT IT: nothing safe; this is a product decision.
EXACT EXTERNAL DEPENDENCY: owner decision.
NEXT ACTION: owner answers; I narrow the view in a migration if asked.

BLOCKER: CP-B4 two deployed Stripe workers do not verify signatures.
WHY: stripe-webhook-worker has a verifier that always returns true; stripe-dunning only checks that a stripe-signature header exists, then parses the body. Anyone who can reach them can post a forged event.
EVIDENCE: deployed code read through the Cloudflare connector (section 8.2). Not tested over the network.
WHAT I CAN DO WITHOUT IT: nothing safe to deploy; neither worker has source in the repo.
EXACT EXTERNAL DEPENDENCY: founder decides fix or delete for each, and checks the Stripe dashboard endpoint list (Q-1) to see whether either is registered and what it can do if reached.
NEXT ACTION: founder decision; I write the verified version into the repo once the target is chosen.

BLOCKER: CP-B5 humanHold and production_send are founder-override switches.
WHY: they gate real payments being fulfilled and real outbound email. Founder direction is that these are the only gates; flipping them is the founder action, not the session.
EVIDENCE: section 8.4 locates each switch and what else must be true before it has any effect.
WHAT I CAN DO WITHOUT IT: everything around the gates, which is built and tested.
EXACT EXTERNAL DEPENDENCY: founder edit, one per switch.
NEXT ACTION: founder edits when ready.

## 6. Next actions

1. Founder: merge !2001 when its pipeline on 22936e2c finishes green (a merge to main can deploy), then !2003, then !2005.
2. Founder: paste the section 4 SQL (CP-B1); decide CP-B3 and CP-B4; toggle leaked password protection if wanted.
3. CP-N1 Recover verify_asset, resolve_asset, score_asset, get_asset_provenance, get_public_verification, increment_portal_scan into a migration. Verify by comparing md5 of the live pg_get_functiondef output with the file; no apply.
4. CP-N2 Export the 59 unversioned edge functions into supabase/functions, starting with stripe-webhook, qron-checkout, storefront-checkout, validate-api-key and authichain-verify. Needs a supabase CLI download or per-function reads; stripe-webhook is a 1 MB bundle, so export it as the deployed artifact and note the upstream template.
5. CP-N3 Local reproduction of the authichain-verify path-segment issue against a stub.
6. MR !2003 (dogfood release attestation binding, N-3) is reviewed in section 7: sound, with four low-severity follow-ups, pipeline green and mergeable. Merge is a one-click founder action (8.3); fold the evidence into VERIFICATION_EVIDENCE.
7. Stripe sandbox E2E (N-4) once sandbox keys are provided through an approved channel. Sandbox only.
8. Fold this checkpoint into the numbered ledger files after PR #1995 lands.

## 7. MR !2003 review (dogfood release attestation binding)

Reviewed at head faafca4e, pipeline 2977671914 success. Three files: scripts/lib/dogfood-release.mjs (new), scripts/lib/dogfood-release.test.js (new), scripts/generate-dogfood.mjs (modified). Method: read all three from the branch; confirmed the tests sit inside the root vitest include (scripts/**/*.test.js), so quality_gate runs them; read the dogfood_record job in .gitlab-ci.yml (it runs generate-dogfood.mjs and publishes the record as an artifact). I did not run the tests locally; the CI result is the evidence.

Verdict: sound for the claim it makes. The record binds commit, version, time and the SHA-256 of package.json, pnpm-lock.yaml, protocol/verifier.mjs and .gitlab-ci.yml. The protocol verdict is valid-unanchored, never verified. The record states its own limits, and no-record is a separate verdict from every failure, so not found is never reported as counterfeit.

Negative cases present in the tests: a changed artifact under a still-valid signature (mismatch); a one-byte change in each default artifact; wrong commit; wrong version; missing file; artifact left out of the record; artifact the record adds; absent binding blocks; overclaimed trust scope; stale; five tampered fields (invalid); signature from the wrong key; future-dated; missing fields; missing file versus unparseable file; and fail-closed generation for an unknown commit, a malformed commit, an unreadable artifact, a file that changes during generation, a missing version and path traversal.

What a bound verdict does and does not show: the signing key is a one-off key, so anyone can produce a bound record for a tree they control. Bound means the record matches this tree and was not edited after signing. It does not show who made it. The module says this itself.

Low-severity follow-ups, none blocking:
1. verifyRecordFile reports every read error as no-record, not only a missing file. A permission error or a directory path then reads as 'nothing to check'. Treat only ENOENT as no-record.
2. generate-dogfood.mjs --verify builds the path with join(process.cwd(), arg). An absolute path becomes the working directory plus that path, the file is not found, and the result is no-record (exit 3). It fails closed but misdiagnoses. Use path.resolve.
3. generatedAt is checked for age but not for lying in the future. A hand-signed record with validFrom in the past and generatedAt far ahead never goes stale. Reject a generatedAt later than now plus CLOCK_SKEW_MS.
4. isSafeRelativePath does not resolve symlinks, so a tracked symlink named in a record could be hashed outside the repository (digest only, no content). Contrived; resolve real paths if the verifier ever runs on untrusted trees.

Not covered by the suite: the CLI exit codes (0 bound, 1 failure, 2 usage, 3 no-record). A small spawn test would cover them. No comment was posted on the MR; this section is the record.

## 8. Work after the first push of this checkpoint

### 8.1 Evidence for CP-B1 (who calls verify_asset)

Edge logs were searched for the text verify_asset in three consecutive 24 hour windows ending 2026-10-22 14:30Z: zero hits in each. The same search method on the string /rpc/ finds 38 REST function calls in the latest window, so REST RPC traffic is visible to it. The repository has no caller (the only match is docs/ESTATE-RECOVERY-2026-10-06.md). verifications holds 7 rows and verification_usage 0. Conclusion: nothing observable depends on the anonymous grant. The limit is the window: a caller that runs less often than every three days would not appear.

### 8.2 Cloudflare worker audit (read-only, through the connector while it was up)

| Worker | Finding | Reachability and registration |
| ------ | ------- | ----------------------------- |
| stripe-webhook-worker | The signature verifier always returns true. Any POST is accepted as a Stripe event. | Unknown. Not probed over the network. |
| stripe-dunning | Rejects a request with no stripe-signature header, then parses the body with no HMAC check. A header with any value passes. | Unknown. Not probed over the network. |
| dpp-fulfillment (R5) | Signature verification present. | Unknown whether Stripe calls it (Q-1). |
| authichain-license-issuer | Signature verification present. Two weaker points: the compare uses a plain === rather than a constant-time compare, and STRIPE_WEBHOOK_SECRET is also used as the bearer token for the revoke route, so one secret serves two purposes. | Unknown. |

The first two have no source under workers/ in the repository. Do not recreate them as deployable directories until the founder chooses fix or delete (CP-B4), because a repo copy of a broken verifier would be redeployed by the next deploy job. Stripe dashboard webhook endpoint list is the quickest way to learn whether either broken worker can receive real events.

### 8.3 Merge status

| MR | Head | Pipeline | State |
| -- | ---- | -------- | ----- |
| !2001 | 22936e2c | 2977904507 running at the time of writing | open; previous head dc10d43b was green |
| !2003 | faafca4e | 2977671914 success | open, mergeable. Two merge attempts by this session were refused by the session permission check (reason: merge without review), once before and once after a blanket approval in chat. This session did not route around it. One click merges it. |
| !2005 | 3126d6fe then this update | 2977862719 success on the first head | open, draft |

### 8.4 Founder-override map

These are the switches that matter. None was changed by this session.

1. Database: section 4 SQL. Evidence in 8.1. One paste, one-line rollback.
2. humanHold: workers/stripe-webhook/src/grant-map.ts marks five price entries with humanHold: true (DPP workspace, passport, MUSA). The payment is recorded and no generations or certificate are issued until the founder releases the price: remove the flag for that entry and deploy. It is per price, so each product can be released independently.
3. production_send: workers/authichain-verify-worker/src/outbound-types.ts defaults it to false. Email also needs human_send_approved on a campaign and an injected sender function. No Resend client is wired (docs/AGENT_OUTBOUND.md), so flipping production_send alone sends nothing; the sender and the campaign approval are the other two steps. The kill switch and attestation revocation block the next send once mail is live.

### 8.5 Opt-in Stripe mock contract test

src/lib/checkout-gate.stripe-mock.test.ts (on the !2001 branch). With STRIPE_MOCK_URL set to a running stripe-mock it posts the gate's real checkout request for qron_launch_annual and starter and expects Stripe's published schema to accept it (22 tests pass locally). It also proves the check has teeth: an injected unknown parameter makes the same call fail with 400. Without the variable the 22 tests are skipped, so CI is unaffected. This is a schema check, not a Stripe sandbox. It does not cover price ids that exist in an account, webhook delivery or fulfillment. The real sandbox end-to-end run still needs test-mode keys through an approved channel (N-4).
