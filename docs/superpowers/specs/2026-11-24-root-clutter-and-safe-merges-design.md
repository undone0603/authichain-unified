# Root clutter cleanup and safe PR merges

Date: 2026-11-24. Size: small change. Status: awaiting owner approval.

## Intent

The owner asked to "clean up clutter and merge the safe PRs" in
`undone0603/authichain-unified`. The goal is a tidier repo root and a shorter
open-PR list, with no behaviour change on production and minimal load on the
self-hosted CI runners (laptop host, memory-constrained).

## Goals

- Delete root files that are verifiably dead.
- Stop committing the Turborepo build cache.
- Merge the open PRs that are low-risk and green after rebase.

## Non-goals

- Removing dead deploy targets (`railway.json`, `vercel.toml`, `.gitlab-ci.yml`,
  `beanstalk/`, `Dockerfile.client`, `Dockerfile.qron`, `ai-gateway-demo/`,
  `.ab-testing/`, duplicate `.env.*example` files). Docs/tests reference them;
  that is approach 2, not chosen.
- Touching `root/`, `local-server.mjs`, `launch-gates-report.json`, `ops/`.
- Updating the owner's diverged local checkout (`feat/wire-mcp-and-hydrogen-shield`,
  2,006 behind, holds a `whsec_` secret in a local commit). Never pushed, never touched.

## Anti-goals

- Any merge that changes payments, secrets, deploy workflows, AgentZ security
  or outreach behaviour without the owner saying so.
- Racing another session's merge train.

## Approaches considered

1. **Conservative (chosen by owner).** One PR deletes only the clearly-dead tier;
   merge only the "safe" list, one PR per green main, via `scripts/ops/merge-train.mjs`
   or sequential `gh pr merge --match-head-commit`.
2. Broad cleanup: also remove dead deploy targets and fix every reference. Rejected:
   bigger PR, higher chance something "unused" is still used.
3. Archive to `docs/archive/` instead of deleting. Rejected: clutter just moves.

## Design

### Cleanup PR (`chore/root-clutter-cleanup`)

Delete from the repo root:

| Path | Why it is dead |
|------|----------------|
| `out.txt` | stray grep dump of a page template |
| `script.py`, `wrap.py` | one-off edits to `workers/authichain-com/src/battery-passport-page.ts` |
| `do_update.py` | one-off "repository updates" script |
| `update.js` | one-off insert into `workers/authichain-com/src/mcp-routes.ts` |
| `.gitkeep` | empty placeholder at a non-empty root |
| `.turbo/` (54 files) | committed Turborepo cache; CI already deletes `.turbo` between jobs |

Evidence: the only references are `docs/execution/ARCHITECTURE_AND_MODULE_MAP.md`
rows AR-9 / "Root strays", which already flag them as unreferenced. (The `update.js`
hits in `server/` are `crm-update.js`, a different file.)

Also:
- add `.turbo/` to `.gitignore`;
- update the AR-9 / "Root strays" rows to record these as removed (keep `root/`
  and `local-server.mjs` listed as still open).

Verification: `git grep` for each deleted name returns only the doc rows;
quality gate (`ci/circleci: main-quality-gate`) green on the PR head.

### Safe merges

"Safe" = not draft, `main-quality-gate` green after rebase onto current main,
small, and does not touch payments, secrets, deploy workflows, AgentZ security
or outreach behaviour.

In scope, in this order (one per green main):

1. the cleanup PR above
2. #2726 fix(x402): OpenAPI info.description + contact email
3. #2717 fix(copy): drop stale QRON unit prices and add a copy guard
4. #2716 feat(agentz): load team operating rules into the architect planner prompt
5. #2736 fix(checkout): Stripe return URLs. Payment path, so only if green after
   rebase; reported back before merge if anything looks off.

Before each merge: rebase (or `gh pr update-branch`), wait for the exact-SHA
quality gate, merge with `--match-head-commit <full sha>`.

Out of scope:

- **All Python Dependabot PRs** (#2691, #2692, #2737–#2746): another session's
  `ci/merge-train-20261125` already holds all 12; its CircleCI `extras` is red.
  Left to that session to avoid a race.
- #2734 (re-enables cold outreach): owner's decision, not a safety call.
- Not safe: #2749, #2628, #2667, #2602 (failing checks); #2697, #2747 (large);
  #2723 (40 workflow files); #2724 (large lockfile churn); #2651 (example app,
  low value); all drafts.

### Deploys

None of the in-scope PRs need a deploy to be "done". If #2717/#2726 change
Worker copy, a follow-up `deploy-authichain-com.yml` dispatch at exact main is
offered, not done automatically.

## Left to the builder

- Whether to use `merge-train.mjs` or sequential merges (sequential is fine for 5).
- Exact wording of the AR-9 doc update.
