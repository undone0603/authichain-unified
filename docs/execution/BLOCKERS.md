# Blockers

Updated 2026-10-22. Each entry: what is stuck, why, evidence, what continues without it, the exact dependency, next action.

## B-1. QRON Launch monthly: closed by an unreviewed gate while public pages still sell it (owner decision needed)

- **Finding:** `src/lib/checkout-gate.ts` returns 403 for `qron_launch` unless a `qron_attestation` form field is posted. The gate arrived in
  commit `cb3f7d2f` on 2026-10-22 01:15 UTC ("feat: inject QRON interdiction gate in checkout POST handler", no description). The confirm page
  renders no such field and nothing issues `QRON-` tokens, so no ordinary buyer can complete monthly Launch. `qron_launch_annual` ($190/yr, added
  2026-10-19) is not gated and is the only Launch SKU a buyer can finish.
- **Owner intent found on review:** PR #1905 ("HOLD: Unlist QRON Launch $19/mo", label `hold`, unmerged) records that the owner took the $19/mo
  plan off the site on 2026-10-17 and carries the `listed: false` change plus the copy removals. `main` still has `listed: true` and still links
  "Start Launch $19/mo" to `/checkout/qron_launch` from `workers/_shared/estate-pricing.ts`, `workers/qron-space/src/index.ts` and
  `worker-app/dynamic-pages.ts`, so buyers who click get the 403. Related open PRs: #1965 (unlist Launch on /pricing, draft), #1941 (restore the
  confirm-page gate, draft, written before `cb3f7d2f`).
- **Corrections to earlier advice in this session:** (1) gating the annual plan was wrong, it would block the one working SKU; (2) removing the
  monthly gate (PR #1996) was also wrong, it re-opens a plan the owner took off sale. PR #1996 is on hold and should not be merged as it stands.
- **Recommended:** keep monthly Launch closed. Finish the unlist from #1905 (`listed: false`, remove the "Start Launch $19/mo" links), and replace the
  misleading "valid physical attestation token required" message with an honest "QRON Launch monthly is no longer offered; choose Launch Annual or
  Starter" response, so the closure is deliberate and visible. No plan or price changes without the owner's go-ahead.
- **Evidence:** `git log -S"QRON Interdiction"` (`cb3f7d2f`); `src/lib/checkout-gate.ts`; `src/lib/plans.ts`; PRs #1905, #1941, #1965;
  `grep "Start Launch"` over the three files above; `workers/stripe-webhook/src/grant-map.ts` (both Launch prices still map to grants, so existing
  subscribers are unaffected either way).
- **Decision needed from Zac:** confirm monthly Launch stays closed (and whether the #1905 merge gates still apply), or reopen it on purpose, in
  which case #1996 is the change. Until then no code change to the gate.

## B-2. Mirror direction: GitHub stays the source of truth (decided 2026-10-22)

- **Why:** the GitLab project is a pull mirror of GitHub (`mirror: true`). Pushes to GitLab `main` would be overwritten.
- **Evidence:** `GITLAB_MIGRATION.md`.
- **Decision (Zac, 2026-10-22):** use the recommended option: keep GitHub primary and GitLab as the pull mirror that feeds Cloudflare Workers Builds and
  CI. No settings were changed. Native GitLab mirroring is one-way, so merging on either host needs a deliberate bridge that is not configured.
- **Consequence:** merges happen on GitHub. GitLab-only branches and MRs have to be carried to GitHub as PRs (!1998 and !1999 became #1995 and #1996; !1997 was not carried over); see B-3.
- **Revisit when:** a GitHub write path exists and GitHub Actions billing (B-4) is resolved, or GitLab is made primary on purpose.

## B-3. Push and write credentials in this session

- **Why:** `git push` returns 403 from the session proxy ("repository not in this session's authorized repository set"); `GH_TOKEN` is
  reported invalid; the GitHub connector (authenticated as `undone0603`) is read-only for this repo; there is no GitLab token in the sandbox.
- **How work reached GitHub:** the owner applied the exported patches locally and opened draft PRs #1995 (tests and docs) and #1996 (gate) on
  2026-10-22. The `docs/execution/*` blob hashes on the #1995 branch match this session's copies.
- **Write path used on GitLab:** the logged-in GitLab browser session through the commits API, to new branches, draft MRs and one confidential
  issue, approved by the owner on 2026-10-22. The first commit (`b8154509`) was made before asking; a later write was refused by the session's
  permission check. `main` was not touched.
- **Without it:** all edits, tests and docs run locally; changes reach GitHub as patches the owner applies.
- **Dependency:** add the repo to the session's sources in the app (not possible from inside the session), or approve a GitHub write path explicitly.

## B-4. GitHub Actions is billing-locked

- **Evidence:** `.gitlab-ci.yml` header; GitHub issue #1871. The autonomy loops in `.github/workflows/` (106 files) therefore cannot run there.
- **Confirmed 2026-10-22:** all 11 checks on PRs #1995 and #1996 failed within 2 to 4 seconds with the annotation "The job was not started because
  your account is locked due to a billing issue." None of those failures is a test result.
- **Without it:** run checks locally; move the highest-value lanes to GitLab schedules within the 400-minute budget.
- **Dependency:** restore GitHub billing, or approve moving lanes to GitLab.

## B-5. GitLab `main` pipeline `2974628977` shows `failed` (external check; build log not readable here)

- **Evidence:** the pipeline has 8 CI jobs, all `manual`, none ran. The only failed item is the external commit status
  `Workers Builds: govchain-us`, posted by Cloudflare on `caf0f083`. The pipeline is red because of a Cloudflare Workers Build, not `.gitlab-ci.yml`.
  A local `wrangler deploy --dry-run` of `workers/govchain-us` succeeds (about 294 KiB), so the Worker code bundles.
- **Unverified candidate:** `workers/govchain-us/wrangler.toml` binds the service `authichain-app` and warns that deploy fails if it is not deployed.
- **Dependency:** the build log is in the Cloudflare dashboard, which this session cannot reach (the Cloudflare connector failed to connect and
  `dash.cloudflare.com` is blocked). Owner action: open the failed `govchain-us` build and read the log, or repair the connector.
- **Without it:** everything else. The five failed `phase-f-dogfood` pipelines were not examined.

## B-6. No production deploy path from a session

- **Why:** no Cloudflare write tooling or credentials in session; the real deploy path is GitHub Actions `workflow_dispatch` or
  push to `main` (per the repo's `steward` policy). GitLab deploy jobs are inert until `CLOUDFLARE_*` variables exist.
- **Without it:** staging-safe checks, dry runs, smoke-test scripts, rollback notes.
- **Dependency:** owner confirmation before any dispatch; CI variables set by the owner.

## Not blockers (intentional gates, left untouched)

`humanHold` on DPP prices (`workers/stripe-webhook/src/grant-map.ts`), `production_send=false` (`outbound-types.ts:67`),
Stripe webhook verification, and `fulfillDppPaidSession` were preserved. Only tests were changed.
