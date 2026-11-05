# CircleCI $0 hosted runner — fail-closed acceptance

**Status (2026-11-05): Candidate only; NO execution authorized until account checks pass.**

Repository: `undone0603/authichain-unified` (public)  
Review PR: #2365  
CI file: `.circleci/config.yml`

## Why this path

CircleCI Free supports Docker **Large**, but not **X-large**. The previous
configuration specified X-large for every job. A public open-source
repository may receive up to 400,000 free Linux build credits per month,
subject to the actual account's plan, project classification, and eligibility.
References: <https://circleci.com/pricing/> and
<https://circleci.com/docs/guides/plans-pricing/credits/>.

This change **does not** prove the existing CircleCI failure was caused solely
by resource class, does not create free quota, and does not make CI green.

## Account-level conditions, checked by an authorized CircleCI administrator

1. Confirm the CircleCI organization is on **Free**, the repository is treated
   as a **public open-source project**, and free Linux build credits are
   available. Record redacted evidence; CircleCI notes OSS credit balances
   may not be visible in the normal UI.
2. Confirm no paid plan, auto-refill, add-on, usage-based charge, or purchase
   will be enabled by running this job. STOP if a charge is possible.
3. In the project settings audit **all** Project Environment Variables, Contexts,
   SSH checkout keys, project hooks, personal tokens, and OIDC trust/policy.
   Remove production secrets from the project. GitHub checkout should require
   only repository read access. No deployment key may have write access.
4. Verify the new `assert-no-production-secrets` step is first in all five
   jobs. This catches known sensitive environment-variable names but **is not
   a complete secret/identity boundary proof**, especially for custom-named
   secrets, OIDC, SSH agents, and inherited contexts.
5. Confirm the execution environment is fresh CircleCI-hosted Docker
   (not `authichain-wsl` or `authichain-ops`), with network access needed
   for the public repository and dependency registry. No mounted local host
   drive, Docker socket, or production credentials.
6. Permit only the owner-authored CI branch for the initial test. Do not run
   code from an unreviewed fork or arbitrary PR until the isolation audit
   independently passes.
7. Require a non-author security reviewer to examine the CI configuration,
   all privileged workflow paths, and the exact intended test commit.

## Verification sequence (no deploy)

- Obtain a fresh report tying the runner/job IDs to the **exact commit SHA**.
- Execute `pnpm install --frozen-lockfile` under pinned Node and pnpm.
- Run CircleCI jobs: `quality`, `typecheck-ratchet`, `test-workers`,
  `test-other`, `build`.
- Record each job's status, stderr, test artifacts, memory/heap failures and
  any missing modules. **Queued/skipped/failed-to-start is not passing.**
- Test the checkout/x402 staging head separately after its latest main merge
  and independent reviewer approval: `security/fail-closed-checkout-x402-20261105`.
- Do **not** claim release readiness from a CircleCI config-only test commit.
- Repeat the native test suite for the actual exact head to be released;
  then obtain independent security review of Stripe webhook/fulfillment
  risk in draft PR #2270 and run a controlled staging paid/unpaid DPP flow.

## Holds

- `humanHold=true` and `production_send=false` stay in place.
- Do not disable branch protections, bypass reviewers, merge economic changes,
  start production deployment, run self-hosted untrusted PR code, or spend
  money to recover CI.
- Cloudflare Workers Builds and Vercel existing build configurations may deploy
  live Workers/applications; they are **not** approved credential-free CI runners.

## Revenue north star

The CI milestone enables a safe sale only after paid checkout → verified
webhook → idempotent entitlement → buyer access → independent verification
is demonstrated. Smoke payments and $0 completed checkouts do not count as
independent revenue. Recurring revenue additionally requires a legitimately
subscribed customer and a settled subsequent renewal; do not count one-time
DPP or Starter payments as MRR.
