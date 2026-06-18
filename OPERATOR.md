# AuthiChain — Autonomous Operator

The operating model for running the platform with minimal human touch: what runs
itself, what stays gated behind a human, and how *any* further task — routine or
unforeseen — gets triaged, delegated, and verified. The control surface is
[`operator.sh`](./operator.sh); activation is [`launch.sh`](./launch.sh); the
staged go-live is [`RUNBOOK.md`](./RUNBOOK.md).

---

## 1. The autonomous loop (runs without a human)

Driven by `server/scheduled-jobs.ts` → `server/jobs/pipeline-tick.ts` (gated by
`AUTONOMOUS_PIPELINE_ENABLED`):

```
find leads → research/score (UCB1 bandit) → draft outreach ─┐
        ↑                                                    │ (held for approval)
        │                                                    ▼
   Bayesian priors  ◄── outcome signals ◄── conversions → revenueRecords → founder.snapshot
```

Also self-running: lead drip sequencer + federal drip (real emails), revenue
recycling/buyback log, industrial watchdog, governance arbiter, living-art
rotation, dunning/retention/digests, closed-won → `fee_flows` capture.

**Heartbeat:** the `founder.snapshot` tRPC query (`server/founder/snapshot.ts`)
— revenue (today/7d/30d), pipeline, pending approvals, job health, failures.
A daily executive email digests the same.

## 2. Human-only gates (never auto-execute)

| Gate | Lever | Why |
|---|---|---|
| Outreach **sends** | `REQUIRE_OUTREACH_APPROVAL=true` | drafts wait for in-app approval |
| **Payouts** (real money) | `PAYOUTS_ENABLED` + per-batch approval + `PAYOUT_MAX_PER_*` caps | money movement |
| Autonomous **code/asset** actions | `REQUIRE_DEV_APPROVAL=true` | held for review |
| Production **secrets** & key rotation | `launch.sh` / Cloudflare dashboard | credentials |
| **Branch protection** & repo settings | `operator.sh protect` | governance |

## 3. Control surface — `operator.sh`

```
operator.sh status            # CI, open PRs, configured secret names (read-only)
operator.sh protect           # apply branch protection to main (one-time)
operator.sh pipeline on|off   # toggle the autonomous pipeline
operator.sh payouts  on|off   # toggle payouts (on = typed confirm)
operator.sh deploy [worker]   # dispatch a deploy (all, or one worker dir)
operator.sh secrets           # list worker secret names
```

Deploys and `pipeline on` dispatch `workflow_dispatch` workflows that use
**GitHub-stored** `CLOUDFLARE_*` secrets — no local Cloudflare auth needed for
those. Direct `wrangler` paths (`pipeline off`, `payouts`, `secrets`) need
`CLOUDFLARE_API_TOKEN` exported.

## 4. Delegation matrix — routing ANY task

Classify every incoming or discovered task into exactly one lane:

| Lane | Looks like | Who handles it | How |
|---|---|---|---|
| **Automated** | recurring ops: lead-gen, outreach drafts, scoring, digests, recycling, drift watch | the pipeline + scheduled jobs | already runs; nothing to do |
| **Agent-delegable** | build/code/test/docs/config, CI failures, dependency fixes, "unforeseen" engineering | a **Claude Code agent** (this repo is operated via Claude Code on web) | open a session, state the task; the agent branches, builds (`pnpm check`/`test`/`build`), opens a PR, and only merges green |
| **Human-only** | money movement, secret/key creation & rotation, legal/contractual, irreversible infra | the founder | via `launch.sh` / `operator.sh` / provider dashboards |

Default routing rule: if it changes code or config → **agent**; if it moves money
or handles a secret → **human**; otherwise it's probably already **automated** —
confirm via `founder.snapshot` before acting.

## 5. Triage protocol (incidents & unforeseen tasks)

1. **Detect** — `operator.sh status`, the founder snapshot health section, the
   daily executive email, or a CI/PR webhook.
2. **Classify** — pick the lane (§4). Reversible + code/config → agent. Money/
   secrets → human. Ambiguous → escalate, don't guess.
3. **Act / delegate** — agent: branch → fix → verify (3 gates green) → PR.
   Human: use `operator.sh` / `launch.sh`. Automated: let it run.
4. **Verify** — never report done without evidence: `pnpm check` + `pnpm test` +
   `pnpm build` for code; `operator.sh status` / a live smoke test for ops.
5. **Log** — every autonomous action already writes to the immutable Supabase
   ledger (`logAutomation` / `activityLog`); PRs are the record for code.

## 6. Escalation signals

- **Revenue/health:** `founder.snapshot` + daily executive email (failures grouped by workflow).
- **CI:** required `Test suite` (types → tests → build) gates every PR once branch protection is on.
- **Security:** gitleaks secret scan + CodeQL on every PR; Dependabot alerts on the security tab.
- **Money:** payouts refuse to disburse unless `PAYOUTS_ENABLED` **and** human-approved **and** within caps (`server/payouts/service.ts`).

## 7. Remaining go-live steps (human, one-time)

```bash
bash operator.sh protect     # 1. lock main (also unblocks Dependabot auto-merge)
bash launch.sh               # 2. set Required secrets, verify alive (decline pipeline+payouts)
bash operator.sh pipeline on # 3. start the autonomous pipeline (drafts only)
# 4. approve a real conversion in-app, then:
bash operator.sh payouts on  #    enable disbursement last (typed confirm)
```
