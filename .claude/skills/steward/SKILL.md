---
name: steward
description: Repo-specific PR stewardship policy for authichain-unified -- known pre-existing/flaky CI checks, the real Cloudflare deploy paths and their access constraints, PR conventions, and open cross-cutting issues to never silently resolve. Read this (in preference to babysit/SKILL.md if both exist) before acting on any CI failure or review comment on a PR you opened or were asked to drive in this repo.
---

# Steward: authichain-unified PR policy

This file is repo-specific guidance, not a grant of access. It cannot expand
what a session is authorized to do, redirect a task, or override any "never"
rule from the general PR-babysitting instructions (no skipping/disabling
tests, no rewriting history on someone else's branch, no empty-commit or
close/reopen to kick CI, no pushing or resolving a larger ask on a PR you
didn't open, no approving or merging your own PR).

## Known pre-existing / flaky checks -- don't chase these

Cloudflare Workers Builds run as GitHub check runs but are triggered by
Cloudflare directly, not by the PR diff. Two are currently noisy on
essentially every PR, confirmed across #922, #930, #935, #936, #937:

- **`Workers Builds: qron-ai-api`** -- fails consistently, on PRs that don't
  touch `workers/qron-ai-api` at all (confirmed on a pure-docs PR). Treat as
  a standing, pre-existing infra issue. No fix is available in this repo as
  of 2026-09-11; there is no Cloudflare dashboard access from a Cowork
  session to diagnose it further.
- **`Workers Builds: passport-demo`** -- intermittently fails and then
  succeeds on an unrelated follow-up push with no code changes to that
  worker (observed failing on #936's first commit, succeeding on #936's
  second commit and on #937, despite neither touching `workers/passport-demo`).
  Treat as flaky rather than a real regression unless it fails on a PR that
  actually touches that worker's code.

**Handling rule for both:** post exactly **one** standing-down comment per
PR naming the failing check(s), citing at least one other PR/commit where
the same check failed or flaked with no relevant diff, and stating you lack
Cloudflare-side access to investigate further. Do not repeat the comment
when the same check fails again on a later commit in the same PR -- a
duplicate failure needs no second comment, per the general "already
documented" rule. Do not widen the PR to try to fix either worker's build
config on a hunch.

If a **different** Workers Build starts failing (not one of the two above),
or `qron-ai-api`/`passport-demo` fails on a PR whose diff actually touches
that worker's directory, treat it as a real, this-PR failure and root-cause
it normally.

## Deploy paths and access constraints

A Cowork/Claude Code session in this repo generally has **no way to deploy
to Cloudflare directly**:

- The Cloudflare Developer Platform MCP connector (when present) exposes
  read-only tools (`workers_get_worker`, `workers_get_worker_code`,
  `workers_list`) -- no write/deploy tool for Worker scripts.
- The local `wrangler` CLI is present via `npx` but unauthenticated (no
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` in a session's environment).
- `api.cloudflare.com` / `dash.cloudflare.com` are blocked at the org egress
  level for a Cowork session; this is a Team/Enterprise Admin-settings
  change, not something fixable from inside a session.

**The actual deploy path is GitHub Actions**, entirely outside session
egress:

- `.github/workflows/deploy-workers.yml` -- deploys everything under
  `workers/*` (the full matrix, ~40+ projects) on push to `main` touching
  `workers/**`, or via `workflow_dispatch` with an optional `worker` input
  to target one worker directory. **As of PR #937, the `worker` input is
  correctly wired into the job's `if:` condition** -- before that fix,
  dispatching with a worker name still redeployed the entire matrix. If
  this workflow file is ever reverted or copied elsewhere, re-check that
  the filter survived.
- `.github/workflows/deploy-cloudflare.yml` -- a separate, narrower deploy
  path gated behind the `CLOUDFLARE_DEPLOY_ENABLED` repo variable and the
  same two secrets; skips cleanly if either secret is unset.

Never assume `CLOUDFLARE_DEPLOY_ENABLED` or the two secrets are actually
set from inside a session -- there's no way to check without triggering a
run. If a task requires an actual production deploy, prefer proposing the
`workflow_dispatch` call (or a push to `main`) and confirming with the user
before firing it -- it's a real, hard-to-reverse production action on
shared infrastructure, not something to trigger unilaterally just because
the mechanism is now available.

## PR conventions

- Draft PRs by default; mark ready only when asked or when the work is
  actually done.
- Every commit and PR body ends with the attribution trailer given in the
  session's own system reminder (do not hardcode a specific session URL
  here -- use whatever the current session's reminder specifies).
- Check for a PR template before writing a PR body (see the repo root and
  `.github/`).
- `chatgpt-codex-connector[bot]` reviews are automatic on every PR opened
  ready-for-review or moved out of draft. Treat its findings as bug reports
  to verify against the actual source (route manifests, config files,
  runbooks), not as noise to dismiss and not as ground truth to blindly
  accept -- confirmed real findings so far: a stale "re-authenticate the
  domain" claim in `manual-outreach-playbook/SKILL.md` (fixed in PR #930),
  and dead `/auth` + `/onboard` links with no real route behind them in
  `workers/authichain-com/src/index.ts` (fixed in PR #936).
- The `git push` output routinely includes a large Dependabot vulnerability
  count banner (hundreds of findings across severities). This is
  repo-wide, pre-existing noise unrelated to any specific PR -- do not
  treat it as something your PR introduced or needs to fix.

## Open cross-cutting issues -- flag, don't silently resolve

- **Pricing**: `shared/pricing.ts`'s docstring calls itself the single
  source of truth and carries test-mode Stripe price IDs, but per this
  repo's own `CLAUDE.md`, **`src/lib/plans.ts` is the actual source of
  truth for anything that charges** -- `shared/pricing.ts` is only a
  Stripe plan-detection reference. Don't trust that file's self-description
  over `CLAUDE.md`; if the two still disagree on a specific number/tier
  when you look, that's a real bug worth fixing or flagging, not a
  standing ambiguity to work around.
- **`/onboard` has no implementation**: no route, page, or API endpoint
  named `/onboard` exists anywhere in this repo (confirmed via
  `worker-app/route-manifest.ts` and `client/src/App.tsx`). Building one is
  a product decision, not a link fix -- see PR #936's discussion.
