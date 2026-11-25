# Root Clutter Cleanup and Safe Merges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete verifiably dead root files, stop committing `.turbo/`, and merge five low-risk PRs one at a time on green main.

**Architecture:** One cleanup PR from branch `chore/root-clutter-cleanup` (worktree `C:\Users\rac\authichain-unified.worktrees\root-clutter-cleanup`), then sequential merges, each pinned to the exact head SHA whose `ci/circleci: main-quality-gate` is green.

**Tech Stack:** git, `gh` CLI, CircleCI statuses (self-hosted runners), Git Bash on Windows.

**Spec:** `docs/superpowers/specs/2026-11-24-root-clutter-and-safe-merges-design.md`

## Global Constraints

- Repo: `undone0603/authichain-unified`. Never touch `C:\Users\rac\authichain-unified` (the owner's diverged checkout).
- Merge only with `gh pr merge <n> --squash --match-head-commit <full 40-char sha>`, run as a standalone command (chaining gets classifier-blocked).
- A PR is mergeable only when `ci/circleci: main-quality-gate` is `success` on that exact head SHA.
- One merge per green main: after a merge, update the next PR's branch so its CI runs against the new main.
- Do not touch the Python Dependabot PRs (#2691, #2692, #2737–#2746) or `ci/merge-train-20261125`; another session owns them.
- Do not merge #2734, drafts, or anything outside the five listed PRs.
- No deploys. If #2717 or #2726 change served copy, report it and offer a `deploy-authichain-com.yml` dispatch; do not dispatch.
- Commits end with the attribution trailer lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_012ejuZ937To6YP54AM9m85X`). PR bodies end with the Claude Code footer and the session URL.

## Review Focus

1. A deleted file is still loaded by a script, workflow or test: `git grep -w` for each name must return only the AR-9 doc rows (Task 1 Step 1 and Step 4).
2. A `.turbo` directory inside a workspace package (`apps/*/.turbo`) is still tracked after the root delete: `git ls-files | grep '/\.turbo/'` must be empty (Task 1 Step 4).
3. A PR head moves between "gate green" and "merge" (a push or another session's update): `--match-head-commit` makes the merge fail instead of merging untested code; on failure, re-read the head and wait again (Tasks 2–6).
4. #2736 changes Stripe return URLs: a buyer on `authichain.com` vs `www.` or a workers.dev host must land back on the same host; read the diff and its test before merging (Task 6 Step 1).
5. The other session merges Dependabot PRs while this plan runs, moving main: always `gh pr update-branch` immediately before waiting on the gate, never reuse a SHA captured before a main move.

---

### Task 1: Cleanup commit and PR

**Files:**
- Delete: `out.txt`, `script.py`, `wrap.py`, `do_update.py`, `update.js`, `.gitkeep`, `.turbo/` (54 files)
- Modify: `.gitignore` (append `.turbo/` with a one-line comment)
- Modify: `docs/execution/ARCHITECTURE_AND_MODULE_MAP.md` (the "Root strays" table row near line 76 and the AR-9 row near line 177)

**Interfaces:**
- Produces: open PR from `chore/root-clutter-cleanup` titled `chore: remove dead root scripts and committed .turbo cache`; its number is used in Task 2.

- [ ] **Step 1: Prove the files are unreferenced**

Run: `for f in out.txt script.py wrap.py do_update.py update.js; do git grep -n -w -F "$f" -- . ':!pnpm-lock.yaml' ':!docs/superpowers/'; done`
Expected: only lines in `docs/execution/ARCHITECTURE_AND_MODULE_MAP.md` and `crm-update.js` import lines in `server/` (a different file). Anything else: stop and drop that file from the delete list.

- [ ] **Step 2: Delete and ignore**

`git rm -q out.txt script.py wrap.py do_update.py update.js .gitkeep && git rm -r -q .turbo`, then append to `.gitignore`:

```
# Turborepo local cache; CI deletes it between jobs — never commit
.turbo/
```

- [ ] **Step 3: Update the architecture map**

"Root strays" row: list only `root/directory.txt`, `local-server.mjs`. AR-9 row: replace the file list with `ops/` (182 files) and `root/directory.txt`, and append "Removed 2026-11-24: `out.txt`, `script.py`, `wrap.py`, `do_update.py`, `update.js`, committed `.turbo/` cache." Keep table column alignment as the file has it.

- [ ] **Step 4: Verify**

Run: `git ls-files | grep -E '(^|/)\.turbo/' | wc -l` → `0`
Run: `git check-ignore -q .turbo/cache/x && echo ignored` → `ignored`
Run: `git status --short | wc -l` → `62` (6 files + 54 cache files + `.gitignore` + the map doc)

- [ ] **Step 5: Commit, push, open PR**

```bash
git add -A && git commit -m "chore: remove dead root scripts and committed .turbo cache" -m "<trailer lines>"
git push -u origin chore/root-clutter-cleanup
gh pr create --title "chore: remove dead root scripts and committed .turbo cache" --body "<what/why, link spec + plan, footer>"
```

The spec and plan docs ride along in this PR.

### Task 2: Merge the cleanup PR

**Interfaces:**
- Consumes: PR number from Task 1.

- [ ] **Step 1: Wait for the gate on the exact head**

Run: `SHA=$(gh pr view <n> --json headRefOid --jq .headRefOid); gh api repos/undone0603/authichain-unified/commits/$SHA/statuses --jq '[.[]|select(.context=="ci/circleci: main-quality-gate")][0].state'`
Expected: `success`. Poll with Monitor (until-loop), not sleep. `failure` → read the failing CircleCI job list, fix, push, repeat.

- [ ] **Step 2: Merge**

Run (standalone): `gh pr merge <n> --squash --match-head-commit $SHA`
Expected: merged. Record the new main SHA.

### Tasks 3–6: Merge #2726, #2717, #2716, #2736 (same procedure, in this order)

Per PR `<n>`:

- [ ] **Step 1: Re-check scope**

Run: `gh pr view <n> --json isDraft,files,mergeable --jq '{d:.isDraft,m:.mergeable,f:[.files[].path]}'`
Expected: not draft, `MERGEABLE`, file list matches the PR title's area (no `.github/workflows/`, no secrets, no `server/webhooks/stripe.ts` except #2736). For #2736 also read `gh pr diff 2736` and confirm the return URL is derived from the request host via an allowlist, with a test covering it; if not, stop and report.

- [ ] **Step 2: Update branch onto current main**

Run: `gh pr update-branch <n>`
Expected: success, or "already up to date". A conflict → stop, report, skip to the next PR.

- [ ] **Step 3: Wait for the gate on the new head** (as Task 2 Step 1)

- [ ] **Step 4: Merge pinned** (as Task 2 Step 2)

- [ ] **Step 5: Note served-copy changes**

For #2726 and #2717: if the diff touches `workers/authichain-com/**`, record "needs authichain-com deploy" for the final report.

### Task 7: Wrap-up

- [ ] **Step 1:** Delete the merged branch and remove the worktree: `git worktree remove ../authichain-unified.worktrees/root-clutter-cleanup`.
- [ ] **Step 2:** Report: merged PRs with SHAs, any skipped and why, deploy offers, and the other session's train status (read-only).
