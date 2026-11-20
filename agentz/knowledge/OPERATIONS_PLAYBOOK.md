# AgentZ operations playbook

What AgentZ needs to run AuthiChain operations without rediscovering it. Every item here was observed or verified on 2026-11-19. Re-check anything time-sensitive (runner names, PR numbers, lead status) before acting on it.

AgentZ may read, research, plan, dry-run and draft on its own. The owner gates are unchanged: messages to prospects, spending, merging, deploying, credentials, DNS, the runner-isolation attestation, and AgentZ's own guardrail code.

## Merge queue

- Merge one PR per green main, or a tested merge train. After each merge or train, wait for all 8 `ci/circleci:*` statuses on the new main commit before the next one.
- **Merge train**, the fast path that is just as safe:
  - `node scripts/ops/merge-train.mjs build <prs…>` trial-merges the queue onto main (refusing any conflict) and pushes `ci/merge-train-<date>`.
  - `status <prs…>` prints the pinned merge commands only when the train's gate and every PR's own gate are green.
  - On 2026-11-19 this took 8 PRs from about 8 CI cycles to 1. After squash merges, main's git tree equals the train's tree; check this with `git rev-parse main^{tree}`.
  - Delete the train branch afterwards.
- Merge with `gh pr merge <n> --squash --match-head-commit <sha>`, where `<sha>` is the head the required gate passed on. It must be the **full 40-character SHA**; a short SHA is rejected. Run it as a standalone command. Chained with other commands, it gets blocked.
- Find real conflicts with `git merge-tree --write-tree origin/main <branch>`, not by guessing from file names. Two PRs touching the same file often merge cleanly. Two PRs adding entries to the same line, such as the test lists in `lint.yml` and `package.json`, always conflict. Resolve those by keeping both entries.
- A conflict that is two designs of the same thing is not mechanical. Example: #2455 vs #2536, two D1 lease schemas with two migrations both numbered `0002`. Never auto-resolve it: comment a plan and ask.
- Mark a draft ready only when it is next to merge.
- Before ordering a queue, list each PR's files. Two PRs that touch the same file go in sequence, and the second is rebased after the first merges. On 2026-11-19, `workers/authichain-com/package.json` (the explicit test list) and `.circleci/quality-check.sh` caused this.
- The only required check is `ci/circleci: main-quality-gate`. GitHub's "unstable" usually means a non-required check is still running.
- Respect hold wording in PR bodies: "do not merge", "keep this PR draft", "dormant", "owner decision", "not an approval to merge", "release hold". Never flip those to ready.

## Deploys

- Production deploys are manual `workflow_dispatch` with `expected_sha` equal to main's tip. They fail closed unless all 8 CircleCI statuses on that SHA are green.
- Never merge another PR between "main is green" and "deploy finished". The deploy refuses a SHA that is no longer main's tip.
- Which deploy serves what:
  - `deploy-authichain-edge-router.yml`: the `authichain-edge-router` Worker. It serves `POST /api/stripe/webhook`, which calls `server/webhooks/stripe.ts`.
  - `deploy-authichain-com.yml`: the `authichain-com` Worker. It serves the `/battery-passport*` pages and `/mcp`.
- `node scripts/ops/deploy-drift.mjs` shows how many source commits each Worker is behind main. It is read-only.
- All publish jobs run on the `authichain-deploy` label (#2656). Only `wsl-deploy-arm64` has it, and no CI or PR job does.
- **A deploy killed mid-run publishes nothing.** If a deploy fails with "self-hosted runner lost communication" (seen 2026-11-19 when the WSL VM restarted during `pnpm install`):
  1. Confirm main's tip is unchanged and its 8 checks are still green.
  2. Redispatch the same `expected_sha`.
  3. Confirm with `deploy-drift.mjs` (0 behind) and an HTTP 200 smoke test of an affected page.
- After a deploy that changes the Stripe webhook, smoke it with an unsigned `POST /api/stripe/webhook`. Expect 400, never 5xx.

## Runner fleet

The runners live in one WSL Ubuntu VM on the owner's laptop, as user `zac`, under systemd `--user` with linger:

| Unit | Runner | Custom labels |
|---|---|---|
| `actions-runner.service` | `LAPTOP-72MAGTL2` | authichain-ops, authichain-ci, authichain-wsl |
| `actions-runner-wsl.service` | `wsl-zac-arm64` | authichain-ops, authichain-wsl |
| `actions-runner-deploy.service` | `wsl-deploy-arm64` | authichain-deploy |

- Each unit has a 3 GB `MemoryMax` and a host-gate lock (`~/.config/authichain/runner-isolation-attested`).
- The VM has 8 GB and 4 CPUs, with `autoMemoryReclaim=dropCache`. Do not raise its memory. On 2026-11-19 the Windows host fell to 0.4 GB free at 8 GB. After the reclaim setting it had 2.4 GB free.
- **Stranded queue.** After a WSL restart, jobs queued while the runners were offline can stay queued with every runner idle. Fix it by running `systemctl --user restart actions-runner.service actions-runner-wsl.service`, only when they are idle. Jobs are picked up within seconds.
- **Zombie run.** Merge-autopilot run 37642398937 was deleted on 2026-11-19 with owner approval. If another run is "queued" but GitHub refuses to cancel it as completed, `ci_watch` ignores runs queued over 24 h. Deleting one is still the owner's call.
- **Host memory is the root cause of most outages.** When Windows is starved, the WSL VM restarts on its own and kills in-flight jobs: `gh`/`bash` fork failures and "Resource temporarily unavailable" come first. On 2026-11-19 the Windows host had 0.5 GB free:
  - `vmmemWSL` 5.7 GB, `GoogleDriveFS` (Google Drive for desktop) 2.15 GB, System Restore 0.8 GB.
  - Ask the owner to pause Google Drive before long runs.
  - Do not start local builds or Vitest while three runners are busy.
  - The lasting fix is moving the CI runners off the laptop, which is the owner's spending decision.
- **Lint failures.** The GitHub Lint `test` job runs root Vitest, capped at 2 workers on self-hosted runners (#2655). "Runner lost communication" during that step means the VM was starved for memory. It is not a test failure.
- **Local tests on the owner's laptop.** Root Vitest hangs there under memory pressure, so rely on CircleCI `test-workers` and `test-other`. Run AgentZ's Python tests in WSL with `~/.agentz-venv`.

## ci_watch

- `ci_watch` is read-only. It checks the 3 runner units, main-quality-gate and Lint on main, and queued runs stuck for 30 min to 24 h.
- It runs every 15 min from `agentz-ci-watch.timer`, out of a detached worktree `/home/zac/worktrees/agentz-ci-watch-<sha>`. That worktree is separate from the `authichain-agentz` service pin.
- Its latest result is in `~/.local/state/agentz/ci_watch-last.json`.
- After a `ci_watch` change merges, repin the timer:
  1. Create a worktree at the merge commit.
  2. Point `WorkingDirectory` in `agentz-ci-watch.service` at it.
  3. Run `daemon-reload`.
  4. Remove the old worktree.
- AgentZ must not execute CI jobs on this host. `gha_port` keeps that held because the host holds AgentZ's signing keys.

## AgentZ service pin

- `authichain-agentz` (uvicorn on 127.0.0.1:8000) runs from a detached worktree set in the drop-in `~/.config/systemd/user/authichain-agentz.service.d/50-lr-pinned-worktree.conf`. On 2026-11-19 it moved from `agentz-pinned-a209e9ba` to `agentz-pinned-6fdbfe5bc`.
- Merged AgentZ code is **not live** until the pin moves. Repin after AgentZ PRs land:
  1. Create a worktree at the main SHA.
  2. Run the AgentZ tests there.
  3. Back up the drop-in and rewrite its path.
  4. Run `daemon-reload` and `restart`.
  5. Check that `GET /health` answers.
  6. Keep the old worktree for one-command rollback.
- The planner (`agentz/core/architect.py`) appends this playbook to its system prompt, capped at 12k characters. Keep the playbook factual and short.

## Scheduled routines (claude.ai)

- `trig_0196n8Mo65si64DLmrqvJNxA`, the daily battery reply watch, runs at 14:00 UTC. It reads Gmail, drafts replies and never sends, logs replies in HubSpot, and pushes to ntfy only when something changed.
- `trig_01FzhGxHTknGsqweb2LNi5bV`, the auto-deploy for authichain-com, is **paused**. GitHub `status` webhook triggers cannot be filtered through the API; a filter is silently dropped. So an enabled routine would fire a cloud run on every CI status on every branch. Never enable a webhook-triggered routine without a filter verified in the claude.ai UI.
- New routines attach **every** connector by default. Cut each one down to the connectors it needs right after creating it.

## EU battery passport offer

- The offer is a written gap report: $950 for the first model, $350 for each extra model. It is readiness only: not a conformity assessment, not legal advice, and not an issued passport.
- Plans `battery_gap_report` / `battery_gap_report_extra`. The Stripe price `price_1UREvgGqTruSqV8TMMYXVF69` is live and active. Checkout is `https://authichain.com/checkout/battery_gap_report`.
- The regulatory facts are in `workers/authichain-com/src/battery-chemistry-profiles.ts`. Do not restate them from memory:
  - Passport (Art. 77): from 18 Feb 2027 for industrial batteries over 2 kWh, EV and LMT batteries, every chemistry. Stationary storage counts as industrial.
  - Due diligence (Art. 48, Annex X: Co, natural graphite, Li, Ni): from 18 Aug 2027, per Regulation (EU) 2025/1561.
  - Recycled content (Art. 8: Co, Pb, Li, Ni). Excludes flow batteries, because they have external storage.
  - Carbon footprint (Art. 7): phased, and conditional on delegated acts.
- `/battery-passport/non-lithium` is the page for iron-air, flow, zinc, nickel-zinc and sodium-ion makers.

## Outreach rules

- Every send needs owner approval of the exact recipients and copy. Work two at a time. Drafts are fine.
- Use only addresses the company publishes itself. Never guess an address from a name pattern. Never pitch a media or press inbox.
- Check Gmail (`in:anywhere`) for prior contact before drafting.
- Log every send as a HubSpot contact with `hs_lead_status=ATTEMPTED_TO_CONTACT` and the dated campaign tag in `jobtitle`.
- Emailed on 2026-11-19: Eos, Solid Power, American Battery Solutions, ZincFive, Trojan (C&D), Gotion, Form Energy, ORE Energy, ESS. The ESS address comes from a 2021 sheet and may bounce.
- Skip Microvast (Minespider already provides its passports) and EnerSys (it has its own passport page).
- Lyten has the most EU exposure but publishes only a contact form and a press inbox, so the owner submits that form.
- Follow-ups: one per company around 25–26 Nov, for non-responders only. The owner approves each pair. Any "no thanks" ends contact.

## Money path

1. Reply
2. Checkout
3. Stripe `checkout.session.completed`
4. Founder alert, plus an audit row `battery_gap_report_paid` with status `awaiting_intake` (#2661, once deployed via the edge-router)
5. The owner emails the intake questionnaire: `scripts/battery-gap-report/generate.ts --questions` (#2636)
6. `generate.ts` produces the report for owner review

- Never test the path with a live self-payment. It would count founder money as revenue. Use synthetic Stripe events in tests.
- An automatic intake email to the buyer has not been built. It is an owner decision.

## Windows and WSL gotchas

- From Git Bash, `wsl.exe ... bash -c '...$var...'` loses `$` variables. Write a script file and run it with `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu -u zac -- bash /mnt/c/...`.
- Windows Python is broken on this host. Windows Node runs `.ts` files directly with `--experimental-strip-types` when their imports carry extensions.
- Git Bash's `/tmp` is not visible to Windows Node. Use a Windows path.
- Git Bash rewrites `git show origin/main:path/file`. Prefix it with `MSYS_NO_PATHCONV=1`.
