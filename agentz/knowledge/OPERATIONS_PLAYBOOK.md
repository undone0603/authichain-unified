# AgentZ operations playbook

What AgentZ needs to run AuthiChain operations without rediscovering it. Every item here was observed or verified on 2026-11-19. Re-check anything time-sensitive (runner names, PR numbers, lead status) before acting on it.

AgentZ may read, research, plan, dry-run and draft on its own. The owner gates are unchanged: messages to prospects, spending, merging, deploying, credentials, DNS, the runner-isolation attestation, and AgentZ's own guardrail code.

## Merge queue

- Merge one PR per green main. After each merge, wait for all 8 `ci/circleci:*` statuses on the new main commit before the next one.
- Merge with `gh pr merge <n> --squash --match-head-commit <sha>`, where `<sha>` is the head the required gate passed on. Run it as a standalone command. Chained with other commands, it gets blocked.
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
- **Zombie run.** Merge-autopilot run 37642398937 (2026-10-07) is listed as queued but cannot be cancelled. Ignore it. `gh run delete` is the owner's call.
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
