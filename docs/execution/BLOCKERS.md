# Blockers

Updated 2026-10-22. Each entry covers: what is stuck, why, evidence, what continues without it, and the next action.

**Critical Path to Unblock Shipping:**
1. **B-3 & B-2 (Code Sync):** Fetch GitLab branches (`!1998`, `!1999`) locally, push to GitHub, and merge PRs on GitHub (`main` mirrors back to GitLab).
2. **B-4 & B-6 (Deploy Path):** Restore GitHub Actions billing *or* set `CLOUDFLARE_*` CI variables in GitLab (or deploy locally via `wrangler`).
3. **B-1 (Checkout Verification):** Run a Stripe test-mode checkout on `/checkout/qron_launch` once deployed.
4. **B-5 (Worker Build):** Inspect the `govchain-us` build log in the Cloudflare dashboard.

---

## B-1. QRON Launch checkout gate (Decided 2026-10-22 — Fix in !1999, pending GitHub merge)

- **What & Why:** `src/lib/checkout-gate.ts` required a `qron_attestation` form field to buy `qron_launch` ($19/mo, `listed: true`, live Stripe price), returning 403 for every buyer because the confirm page never rendered the field and nothing in the codebase issues `QRON-XXXXXXXX` tokens.
- **Evidence:** `src/lib/checkout-gate.ts` (gate block on `main`), `src/lib/plans.ts` (both Launch rows), `workers/stripe-webhook/src/grant-map.ts` (both Launch prices map to grants, so monthly fulfilment is wired), `git grep` over `src workers server scripts protocol apps`.
- **Without it:** `qron_launch_annual` ($190/yr, same tier and fulfilment) is ungated and functional.
- **Decision & Done (2026-10-22):** Remove the unissuable check. Draft MR !1999 removes the gate and adds a regression test (`expected 403 to be 303` on `main`). `src` + `protocol` test suite with !1998 and !1999: 159 files, 1,288 passed, 1 skipped, 0 failed. Recorded in Issue #2005 (resolving !1997 thread).
- **Next action (Depends on B-2, B-3, B-6):** Carry !1998 and !1999 to GitHub and merge, deploy to production, and verify with a Stripe test-mode checkout on `/checkout/qron_launch`.
- **Architecture note:** If physical attestation is required later, enforce a JWS attestation checked by the canonical verifier and bound to the object ID with an issuer (the prefix/regex check in !1997 does not provide authorization).

## B-2. Mirror direction: GitHub stays the source of truth (Decided 2026-10-22)

- **What & Why:** The GitLab project is a one-way pull mirror of GitHub (`mirror: true`). Direct merges or pushes to GitLab `main` will be overwritten by GitHub.
- **Evidence:** `GITLAB_MIGRATION.md`.
- **Decision (2026-10-22):** Keep GitHub as the primary source of truth and GitLab as the pull mirror feeding Cloudflare Workers Builds and CI.
- **Without it:** Branching and CI testing on GitLab branches work normally, but merges must happen on GitHub.
- **Next action (Depends on B-3):** Carry GitLab-only branches/MRs (!1997, !1998, !1999) to GitHub as PRs and merge there. Revisit only if GitHub Actions billing (B-4) remains locked long-term and GitLab is intentionally promoted to primary.

## B-3. Agent session push and write credentials

- **What & Why:** Automated sessions cannot push directly to GitHub (`git push` returns 403 from the session proxy: *"repository not in this session's authorized repository set"*; `GH_TOKEN` is invalid; the `undone0603` GitHub connector is read-only and returns 403 on branch creation; no sandbox GitLab token is present).
- **Without it:** All edits, tests, and docs run locally; commits are written to GitLab feature branches via the logged-in GitLab browser session API (approved 2026-10-22; blob hashes verified against local copies; `main` untouched).
- **Next action (Owner):** Either carry the GitLab branches to GitHub from a local terminal:
  `git fetch gitlab && git push github gitlab/fix/p1-dpp-fulfill-test-cas-mock:fix/p1-dpp-fulfill-test-cas-mock`
  or authorize the repo for the session git proxy / grant the GitHub connector write scope.

## B-4. GitHub Actions is billing-locked

- **What & Why:** GitHub Actions runners are blocked by a billing lock, preventing the 106 workflow files (including autonomy loops and deploy workflows) in `.github/workflows/` from executing.
- **Evidence:** `.gitlab-ci.yml` header; GitHub Issue #1871.
- **Without it:** Local test suites and GitLab CI jobs within the 400-minute quota continue to run.
- **Next action (Owner):** Restore GitHub Actions billing, or approve migrating the highest-value scheduled lanes and deploy jobs to GitLab CI.

## B-5. GitLab `main` pipeline `2974628977` shows `failed` (Cloudflare external status)

- **What & Why:** Pipeline `2974628977` on `caf0f083` is marked `failed` solely due to the external commit status `Workers Builds: govchain-us` posted by Cloudflare. All 8 `.gitlab-ci.yml` jobs are `manual` and did not fail.
- **Evidence:** GitLab pipeline `2974628977`. A local `wrangler deploy --dry-run` of `workers/govchain-us` succeeds (~294 KiB bundle), indicating a deployment/binding issue rather than a build syntax error.
- **Probable cause:** `workers/govchain-us/wrangler.toml` binds the service `authichain-app` and fails deployment if `authichain-app` is not already deployed in the target account/environment.
- **Without it:** Core app tests, unrelated Workers, and repository maintenance continue unaffected (note: five failed `phase-f-dogfood` pipelines remain unexamined).
- **Next action (Owner):** Open the Cloudflare dashboard (`dash.cloudflare.com`), inspect the `govchain-us` Workers Build log for commit `caf0f083`, and verify whether `authichain-app` service binding is missing.

## B-6. No automated production deploy path active

- **What & Why:** Sessions have no Cloudflare write credentials, GitLab deploy jobs are inert until `CLOUDFLARE_*` CI variables are configured, and the primary GitHub Actions deploy path (`workflow_dispatch` / push to `main` per `steward` policy) is currently blocked by the GitHub billing lock (B-4).
- **Without it:** Local dry runs (`wrangler deploy --dry-run`), staging-safe checks, smoke-test scripts, and rollback documentation.
- **Next action (Owner):** To deploy !1998 and !1999 after merging to GitHub `main`, either:
  1. Unlock GitHub Actions billing (B-4) and confirm `workflow_dispatch`,
  2. Configure `CLOUDFLARE_*` variables in GitLab CI settings, or
  3. Deploy manually from an authenticated local shell.

---

## Not blockers (intentional gates, left untouched)

- `humanHold` and `production_send=false` safeguards.
- `provisionPurchase` entitlement provisioning logic.
- Stripe webhook signature verification.

`humanHold` on DPP prices (`workers/stripe-webhook/src/grant-map.ts`), `production_send=false` (`outbound-types.ts:67`),
Stripe webhook verification, and `fulfillDppPaidSession` were preserved. Only tests were changed.
