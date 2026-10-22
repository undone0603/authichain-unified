# Blockers

Updated 2026-10-22. Each entry: what is stuck, why, evidence, what continues without it, the exact dependency, next action.

## B-1. QRON gate cannot be made cryptographic: no token issuer exists

- **Why:** `src/lib/checkout-gate.ts` gates `qron_launch` on a `qron_attestation` form field, but nothing in the codebase issues
  `QRON-XXXXXXXX` tokens. Searches found only admin serial text (`QRON-XXXX-XXXX`), trial IDs (`QRON-TRIAL-<timestamp>`), referral
  codes and demo strings. Any value starting `QRON-` passes on `main`; MR !1997 tightens that to a format regex, which is still not
  authorization.
- **Evidence:** `src/lib/checkout-gate.ts:731-746`; `git grep` over `src workers server scripts protocol apps`.
- **Also confirmed on `main`:** the gate tests `plan.id === "qron_launch"` only, while the success-URL logic treats
  `qron_launch_annual` as a generation pack (`checkout-gate.ts:419-420`), so the annual plan is not gated.
- **Without it:** share one gated-plan predicate, cover `qron_launch_annual`, replace the "cryptographic" wording, add tests
  for missing, lowercase, malformed and well-formed-unknown tokens.
- **Decision needed from Zac:** how tokens are issued and checked: (a) HMAC with a Worker secret, (b) a lookup in an attestation
  store, or (c) a JWS attestation checked by the canonical verifier and bound to `expected_object_id` (reuses `fixtures/attestation-v0.1-*`
  and `/api/v1/attestations/verify`). Also whether the gate should fail closed for sales until then.
- **Next action:** implement the no-regret part on its own branch; hold the verification choice for the owner.

## B-2. Mirror direction: GitHub is the source of truth

- **Why:** the GitLab project is a pull mirror of GitHub (`mirror: true`). Pushes to GitLab `main` would be overwritten.
- **Evidence:** `GITLAB_MIGRATION.md`.
- **Without it:** all engineering continues on GitHub branches that the mirror carries to GitLab.
- **Decision needed from Zac:** switch GitLab to primary (disable the pull mirror, optionally mirror back to GitHub), or keep GitHub primary.

## B-3. Push and write credentials in this session

- **Why:** `git push` returns 403 from the session proxy ("repository not in this session's authorized repository set"); `GH_TOKEN` is
  reported invalid; there is no GitLab token. The GitHub connector (authenticated as `undone0603`) works and is the write path used.
- **Without it:** all edits, tests and docs, with pushes through the GitHub connector as whole-file commits.
- **Dependency:** add the repo to the session's authorized set (or supply a scoped token through the approved mechanism). No
  credentials were requested or entered.

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
