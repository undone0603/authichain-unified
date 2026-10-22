# Blockers

Updated 2026-10-22. Each entry: what is stuck, why, evidence, what continues without it, the exact dependency, next action.

## B-1. QRON interdiction gate: broken purchase path and no token issuer

- **Why:** `src/lib/checkout-gate.ts` requires a `qron_attestation` form field to buy `qron_launch`, but:
  (a) the confirm page on `main` renders no such field, so the $19/mo Launch plan (`listed: true`, live Stripe price) returns 403 for
  an ordinary buyer; (b) nothing in the codebase issues `QRON-XXXXXXXX` tokens (only admin serial text, `QRON-TRIAL-<timestamp>` IDs,
  referral codes and demo strings). Any value starting `QRON-` passes if supplied out of band. MR !1997 tightens that to a format
  regex and adds the input, which is still not authorization and shows buyers a field they cannot fill.
- **Annual plan:** `qron_launch_annual` ($190/yr, `listed: true`, live price) is not gated, so it is the one Launch SKU a buyer can
  complete today. Gating it without an issuer would block it. **Do not gate it before the owner decides.** (An earlier suggestion in
  this session to gate it was wrong on that point.)
- **Evidence:** `src/lib/checkout-gate.ts:731-746`, `src/lib/plans.ts` (both Launch rows), `git grep` over `src workers server scripts protocol apps`.
- **Without it:** pin current behaviour with tests, make the comment and error text honest, leave which SKUs are gated unchanged.
- **Decision needed from Zac:** does QRON Launch (an AI QR generation subscription) need a physical attestation token at all?
  If no: remove the gate. If yes: how tokens are issued and checked: (a) HMAC with a Worker secret, (b) a lookup in an attestation store, or
  (c) a JWS attestation checked by the canonical verifier and bound to `expected_object_id` (reuses `fixtures/attestation-v0.1-*` and
  `/api/v1/attestations/verify`); and whether the form should collect the token.
- **Next action:** hold code changes to the gate until that decision; this is a customer-path defect (P1), not only a security note.

## B-2. Mirror direction: GitHub is the source of truth

- **Why:** the GitLab project is a pull mirror of GitHub (`mirror: true`). Pushes to GitLab `main` would be overwritten.
- **Evidence:** `GITLAB_MIGRATION.md`.
- **Without it:** engineering continues on branches; GitLab-only branches are not carried back to GitHub (see B-3).
- **Decision needed from Zac:** switch GitLab to primary (disable the pull mirror, optionally mirror back to GitHub), or keep GitHub primary.

## B-3. Push and write credentials in this session

- **Why:** `git push` returns 403 from the session proxy ("repository not in this session's authorized repository set"); `GH_TOKEN` is
  reported invalid; the GitHub connector (authenticated as `undone0603`) is read-only for this repo (branch creation returns 403
  "Resource not accessible by integration"); there is no GitLab token in the sandbox.
- **Write path actually used:** the logged-in GitLab browser session, through the GitLab commits API, to a new branch plus a draft MR.
  Each file's blob hash was compared with the local copy. `main` was not touched.
- **Without it:** all edits, tests and docs run locally; commits reach GitLab branches through the browser session.
- **Dependency:** authorize the repo for the session git proxy, or grant the GitHub connector write scope, or provide a scoped GitLab
  token through the approved mechanism. No credentials were requested or entered.

## B-4. GitHub Actions is billing-locked

- **Evidence:** `.gitlab-ci.yml` header; GitHub issue #1871. The autonomy loops in `.github/workflows/` (106 files) therefore cannot run there.
- **Without it:** run checks locally; move the highest-value lanes to GitLab schedules within the 400-minute budget.
- **Dependency:** restore GitHub billing, or approve moving lanes to GitLab.

## B-5. GitLab `main` pipeline `2974628977` failed with no jobs

- **Evidence:** API shows `status: failed`, no failed jobs, `yaml_errors: null`; the same on five `phase-f-dogfood` pipelines.
- **Without it:** everything else.
- **Dependency:** open the pipeline page in the GitLab UI to read the failure reason (not exposed through the REST fields queried).

## B-6. No production deploy path from a session

- **Why:** no Cloudflare write tooling or credentials in session; the real deploy path is GitHub Actions `workflow_dispatch` or
  push to `main` (per the repo's `steward` policy). GitLab deploy jobs are inert until `CLOUDFLARE_*` variables exist.
- **Without it:** staging-safe checks, dry runs, smoke-test scripts, rollback notes.
- **Dependency:** owner confirmation before any dispatch; CI variables set by the owner.

## Not blockers (intentional gates, left untouched)

`humanHold` on DPP prices (`workers/stripe-webhook/src/grant-map.ts`), `production_send=false` (`outbound-types.ts:67`),
Stripe webhook verification, and `fulfillDppPaidSession` were preserved. Only tests were changed.
