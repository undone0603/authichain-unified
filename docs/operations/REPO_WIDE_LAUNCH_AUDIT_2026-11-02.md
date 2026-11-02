# AuthiChain unified — repository-wide inventory and launch-path audit

**Audited:** 2026-11-02 UTC  
**Frozen source:** `main` at `f2327ee55fb53977811a34656a35e5650b5ebfd6`.  
**Scope:** all recursive Git-tree entries, with targeted source-level review of production-critical surfaces. **Not** an exhaustive manual line-by-line review or certified security audit.

## Evidence and limits

- GitHub's `git/trees/{sha}?recursive=1` returned `truncated=false`: **6,254 entries = 4,920 blobs + 1,334 trees**. This is a complete **tracked-file inventory** for the SHA, not every file's content or git history.
- 114 GitHub Actions `.github/workflows/*.yml` files. Primary tracked areas: apps (1,129 files), src (586), docs (547), workers (434), scripts (409), server (307), agentz (253), ops (183), supabase (131), protocol (100). The standalone `worker-app` contains 49 files.
- Read key source directly: `.github/workflows/{main,ci,self-hosted-ops-smoke,gov-engine,gov-ingest,gov-score,production-smoke-gate,deploy-qron-space}.yml`, `.gitlab-ci.yml`, `worker-app/{index.ts,wrangler.toml}`, `src/lib/{a2a-jsonrpc,qron-resolve,stripe-webhook-claim,paid-seal-verify}.ts`, `workers/authichain-com/src/{x402-routes,index}.ts`, `workers/{qron-space,govchain-us,strainchain-io}/src/index.ts`, `workers/govchain-us/src/supabase.ts`, `server/webhooks/stripe.ts`, `workers/stripe-webhook/src/grant-map.ts`, `workers/authichain-verify-worker/src/outbound-gate.ts`, `worker-app/dynamic-pages.ts` and existing tests/configs.
- Cross-checks from the connected Cloudflare account, connected QRON-v2 Supabase project and read-only public HTTP GET observations. Supabase's second project SQL interface timed out; it is **not** covered.
- No secrets are printed or saved in this report. No payment, production deployment, merge, outreach, form submission or database mutation was performed.

## Findings — priority and exact evidence

### P0 — Anonymous A2A tasks share a default module-global store on main

`src/lib/a2a-jsonrpc.ts` declares `const defaultStore = memoryA2aStore()` and uses it when `opts.store` is absent. `workers/authichain-com/src/x402-routes.ts` invokes `handleA2aJsonRpc` without an explicit caller-scoped store for public `POST /api/a2a`; `ListTasks` and `GetTask` have no authenticated owner check. Within a reused isolate, one anonymous caller could potentially enumerate another's stored task history. **Source-confirmed design risk; no customer exposure was tested or claimed.**

**Existing remediation:** [draft PR #2269](https://github.com/undone0603/authichain-unified/pull/2269) uses request-local stores and a 64 KiB anonymous request cap, with cross-request regression fixtures. Keep this as a release gate: exact-head real CI and independent security review before publishing task-persistence claims.

### P1 — CI execution capacity and evidence

- `main.yml` has a single required `Main quality gate` which chooses a self-hosted `[self-hosted,Linux,ARM64,authichain-ops]` pool only if `AUTHICHAIN_CI_SELF_HOSTED=true`; otherwise it chooses `ubuntu-24.04`.
- `self-hosted-ops-smoke.yml` is a **no-checkout, no-secret** manual identity probe with exactly those dedicated runner labels. This is the smallest safe runner readiness proof; **no job allocation is confirmed by this audit**.
- Observed November 2 public draft-PR GitHub jobs failed without a runner assigned or executing steps. GitLab pipeline 3017597554 failed `ci_quota_exceeded` before test execution. Do not interpret as code-test failures or bypass required checks.
- `deploy-qron-space.yml` targets `authichain-wsl`, a **different** self-hosted label from `authichain-ops`. Verify the actual authorized isolated host and label before trying to reuse any runner, especially for untrusted PRs.

### P1 — GovChain current opportunity production gap

- Connected QRON-v2 Supabase `public.gov_opportunities_public`: **5,333** visible rows, **26** with `fit_score>=70`, **zero** high-fit rows with unexpired deadlines; latest `ingested_at` = **2026-10-14 11:03 UTC**.
- Public `https://govchain.us/opportunities` truthfully shows no qualifying open opportunities.
- `workers/govchain-us/src/supabase.ts` correctly filters expired deadlines and reads a publicly scoped view. The prior 2026-09-18 view migration fixed a false empty-list condition; don't re-enable public access to base tables or internal procurement PII.
- `.github/workflows/gov-engine.yml` schedules **ingest live** at 06:05 UTC but explicitly runs **score in dry-run**; `scripts/score-opportunities.ts` only updates persisted `fit_score` when `DRY_RUN` is not `true`. Thus even a healthy nightly ingest cannot by itself refresh the high-fit public shortlist. The GitHub workflow also requires the same isolated `authichain-ops` runner.
- **$0 route:** validate runner and ingestion first; then propose an owner-reviewed, reproducible offline/deterministic scoring mode or an authorized scored batch. Do not enable metered LLM providers, automatically draft/send proposals or fabricate scored opportunities.

### P2 — QRON homepage advertises a stored QR example that responds HTTP 400

- `workers/qron-space/src/index.ts` at inspected `main` asserted the stored scan path `/qron/r/qron%3Aurl%3A71cead6b`.
- Fresh external read-only GETs returned **HTTP 400** on both `https://qron.space/qron/r/qron%3Aurl%3A71cead6b` and the canonical `https://authichain.com/qron/r/qron%3Aurl%3A71cead6b`. Cause not established: it is **not** evidence of counterfeit, storage compromise or a verified working demonstration.
- This draft branch removes the unproven demo claim from QRON's HTML/SEO and provides fixed-target customer-journey tests. It **has not** changed the live Worker.
- The canonical `src/lib/qron-resolve.ts` correctly documents missing records as `presentation_not_found` / indeterminate; a concrete root-cause investigation and independently successful stored-scan fixture remain outstanding.

### P2 — Cross-brand conversion ambiguity

- `worker-app/dynamic-pages.ts` uses one `onboardPayNowHtml` with **Starter $29 as the first paid checkout** for every brand. StrainChain also offers its own $49 genetics passport. This is not necessarily erroneous, but a buyer seeking a cultivar passport may be confused by the generic Starter-first framing.
- `https://strainchain.io/genetics` currently reports no publicly published libraries. `https://govchain.us/opportunities` reports no open high-fit rows. Don't advertise a completed customer artifact or a filled lead funnel without external evidence.
- Public GET checkout-confirmation pages for Starter, DPP and StrainChain Passport are available. **GET reachability does not verify checkout payment, webhook grant, a durable entitlement, or customer delivery.**

### P2 — Payment trust needs an exact-customer acceptance test

- `server/webhooks/stripe.ts` verifies Stripe signatures and uses `src/lib/stripe-webhook-claim.ts` to fail closed when live event idempotency is unavailable. Multiple historical webhook adapters exist across `apps/`, `server/`, `src/`, `worker/`, `workers/`; distinguish their canonical **deployed route** before interpreting which handlers run.
- `workers/stripe-webhook/src/grant-map.ts` retains `humanHold` for manually fulfilled offers. `workers/authichain-verify-worker/src/outbound-gate.ts` blocks email when `production_send` is false or human send approval is missing.
- Prior live Stripe checkout audit on 2026-11-02 found 788 sessions, including one $10 founder `paid_smoke_10` success and six zero-dollar completed sessions; no independently attributable successful, delivered paying customer was verified. Never count demonstrations, zero-dollar smokes or directory listings as revenue.

### P3 — Repository maintenance drift and duplication

- `docs/execution/REPOSITORY_INVENTORY.md` remains pinned to October 22's `caf0f083`, **4,720 tracked files** and **106 workflows**; this audit establishes **4,920 files** and **114 workflows** at the frozen November 2 SHA. Keep historical inventory but use a dated snapshot for current decisions.
- `.turbo/` contains tracked generated/cache artifacts (54 files); multiple public media assets and CDP protocol JSON files are duplicated across app roots, increasing repo size and patch/CI cost. This is optimization work, **not** a release blocker.
- The recursive file inventory contained no tracked non-example `.env` filename. The sole `.pem` file identified by filename, `certs/supabase-root-2021.pem`, begins with `BEGIN CERTIFICATE`, not a private-key header. **No complete secret-content/history scan was performed**; do not call the repo secret-free on that basis.

## Four-brand public route check

| Brand | Homepage GET | Cloudflare zone and route | Published demo/readiness |
| --- | --- | --- | --- |
| AuthiChain | reachable | active `authichain.com/*` → `authichain-com` | published signed-record demonstration; physical binding unknown |
| QRON | reachable | active `qron.space/*` → `qron-space` | free generator page reachable; hardcoded stored-scan demo HTTP 400 |
| StrainChain | reachable | active `strainchain.io/*` → `strainchain-io` | genetics/passport and onboarding pages reachable; no published public libraries |
| GovChain | reachable | active `govchain.us/*` → `govchain-us` | opportunity page reachable; zero unexpired high-fit records |

All four Workers had deployed version records in Cloudflare. None of these observations proves functional paid fulfillment or official A2A/MCP protocol conformance.

## Unblocking order without buying another service

1. **Security:** Execute and independently review A2A isolation draft PR #2269 before relying on any public task history.
2. **Runner:** Establish authorized isolated `authichain-ops` from the no-secret `self-hosted-ops-smoke.yml`; then execute exact-head CI for release-critical PRs. Leave required reviews/checks enabled.
3. **GovChain:** Restore a fresh ingestion checkpoint, then make a separately reviewed, zero-cost scoring choice. The scheduled scoring stage is intentionally dry today.
4. **QRON:** Diagnose HTTP 400 against the canonical storage binding; meanwhile merge the marketing correction **only after** review and green CI. Don't present a broken scan path as a successful demonstration.
5. **Commercial:** Reconcile one independent live payment to a signed webhook, durable grant and delivered service. No founder self-purchase is customer proof.
6. **AgentZ:** The read-only AgentCard preflight and MCP HTTPX diagnostic reside in draft PR #2275, not `main`. Public discovery is live, but the edge learning Worker explicitly says it is not the Python daemon; an official A2A TCK pass has not been demonstrated.

## Verification and release state

- **Complete:** Tracked-tree enumeration at pinned SHA; representative high-risk source-path inspection; read-only domain/Cloudflare and opportunity-view checks; no-payment QA fixtures committed to a review branch.
- **Not complete:** Whole-file line-by-line security review, historical secret scan, exact-head hosted CI, independent reviewer approval, real end-to-end customer delivery, and full production A2A conformance.
- **Decision:** Keep economic/security changes under review. Maintain `humanHold`, `production_send`, protected branches, private credentials and independent review. No auto-merge, money movement, secret changes or unsolicited outreach.
