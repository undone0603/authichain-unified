#!/usr/bin/env bash
# commit-tsc-zero.sh — stage ONLY the tsc-fix files + session scripts, commit, push
set -eu
cd /home/zac/authichain-unified

git add \
  drizzle/schema.ts \
  server/missions/types.ts \
  server/missions/missions.db.ts \
  server/missions/seed.ts \
  server/agents/commander.ts \
  server/new-features.test.ts \
  scripts/tsc-gate.sh \
  scripts/test-gate.sh \
  scripts/test-detail.sh \
  scripts/baseline-test-check.sh \
  scripts/touched-tests.sh \
  scripts/bonus-test-detail.sh \
  scripts/commit-tsc-zero.sh

git status --short --untracked-files=no | grep '^[MA]' || true
echo "--- staged diffstat ---"
git diff --cached --stat | tail -5

git commit -m "fix: resolve all 17 pre-existing tsc errors (typecheck now clean)

- drizzle/schema.ts: add users.metadata json column (matches loyalty/vouchers
  services; additive migration already applied to live DB)
- missions/types.ts: add REVENUE_OPS mission type + AGENTZ_EXTERNAL task kind
- missions/missions.db.ts: createMission overloads — template form (type) ->
  id string, ad-hoc form ({title, type, tasks}) -> {id, title}
- missions/seed.ts: createMission(type) now returns id directly
- agents/commander.ts: type missionType as MissionType (was any)
- new-features.test.ts: add metadata to user mock; mock insert().returning()

pnpm check: 17 errors -> 0. Touched-file tests 56/56 green.
Pre-existing live-DB-dependent failures in routers/stripe-connect/thirdweb
tests confirmed present at HEAD baseline (documented debt, unchanged).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

git push origin main
echo "--- pushed ---"
git log --oneline -3
