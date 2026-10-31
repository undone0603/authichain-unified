# Blockers

Updated 2026-10-22. Each entry covers: what is stuck, why, evidence, what continues without it, and the next action.

**Critical Path to Unblock Shipping:**

1. **B-2 (Code Sync), resolved 2026-10-22:** GitLab is the working source of truth. Merges on GitLab `main` reach GitHub through the push mirror, so nothing has to be carried to GitHub by hand. B-3 no longer blocks shipping.
2. **B-4 & B-6 (Deploy Path):** Restore GitHub Actions billing _or_ set `CLOUDFLARE_*` CI variables in GitLab (or deploy locally via `wrangler`).
3. **B-1 (Checkout Verification):** Run a Stripe test-mode checkout on `/checkout/qron_launch` once deployed.
4. **B-5 (Worker Build):** Inspect the `govchain-us` build log in the Cloudflare dashboard.

---

## B-1. QRON Launch checkout gate (Decided 2026-10-22 — Fix in !1999, pending GitHub merge)

- **What & Why:** `src/lib/checkout-gate.ts` required a `qron_attestation` form field to buy `qron_launch` ($19/mo, `listed: true`, live Stripe price), returning 403 for every buyer because the confirm page never rendered the field and nothing in the codebase issues `QRON-XXXXXXXX` tokens.
- **Evidence:** `src/lib/checkout-gate.ts` (gate block on `main`), `src/lib/plans.ts` (both Launch rows), `workers/stripe-webhook/src/grant-map.ts` (both Launch prices map to grants, so monthly fulfilment is wired), `git grep` over `src workers server scripts protocol apps`.
- **Without it:** `qron_launch_annual` ($190/yr, same tier and fulfilment) is ungated and functional.
- **Decision & Done (2026-10-22):** Remove the unissuable check. Draft MR !1999 removes the gate and adds a regression test (`expected 403 to be 303` on `main`). `src` + `protocol` test suite with !1998 and !1999: 159 files, 1,288 passed, 1 skipped, 0 failed. Recorded in Issue #2005 (resolving !1997 thread).
- **Next action (Depends on B-2, B-3, B-6):** Carry !1998 and !1999 to GitHub and merge, deploy to production, and verify with a Stripe test-mode checkout on `/checkout/qron_launch`.
- **Update (2026-10-22, later):** !1999 was closed and the hold is now handled by !2001 (open, pipeline green). Read !2001 before acting on the next action above; merging to `main` can deploy checkout changes.
- **Architecture note:** If physical attestation is required later, enforce a JWS attestation checked by the canonical verifier and bound to the object ID with an issuer (the prefix/regex check in !1997 does not provide authorization).

## B-2. Mirror direction: GitLab is the working source of truth (Decided 2026-10-22, supersedes the earlier GitHub-primary decision)

- **What & Why:** The GitLab project has a pull mirror from GitHub and a push mirror to GitHub, both on protected branches only. The earlier entry said a merge on GitLab `main` would be overwritten by GitHub. That was wrong: !1997, !1998, !2000, !2002, !2003, !2004 and !2008 were merged on GitLab today, and the merge commits of !2003 and !2008 are on GitHub `main`.
- **Evidence:** `GITLAB_MIGRATION.md` (mirror settings, last run times, `main` heads equal at `5308335b8f`).
- **Decision (2026-10-22):** On the owner's instruction, GitLab is the working source of truth and GitHub is a downstream mirror.
- **Without it:** Not applicable; nothing is blocked.
- **Next action (Owner):** Disable the pull mirror (GitLab: Settings, Repository, Mirroring repositories) so GitHub is no longer an input to GitLab `main`. It is a project setting and no session changed it.

## B-3. Agent session push and write credentials

- **What & Why:** Automated sessions cannot push directly to GitHub (`git push` returns 403 from the session proxy: _"repository not in this session's authorized repository set"_; `GH_TOKEN` is invalid; the `undone0603` GitHub connector is read-only and returns 403 on branch creation; no sandbox GitLab token is present).
- **Without it:** All edits, tests, and docs run locally; commits are written to GitLab feature branches via the logged-in GitLab browser session API (approved 2026-10-22; blob hashes verified against local copies; `main` untouched).
- **Update (2026-10-22, later):** No longer a shipping blocker. Merged `main` reaches GitHub through the push mirror (B-2). It still means a session cannot push feature branches to GitHub.
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
