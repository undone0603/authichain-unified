# Agent operations

Written 2026-10-22 (NEXT_ACTIONS N-10). Read from the code and configuration of `main` at `caf0f083`. No run history, workflow logs or live settings were read, so this document says what the code allows and requires, not what has run. Retry bounds and idempotency keys are listed only where a line of code sets them; where there is none, the document says so.

Where this file and `docs/OPERATING_CHARTER.md` or `.github/autonomy.json` disagree, those two win (the charter says so itself). A statement marked **(code)** was read in the file named next to it. A statement marked **(not verified)** depends on something outside the repository.

## 1. What "agent" means here

Four different things run unattended. They have different controls, so they are described separately.

| Layer                       | What it is                                                                                         | Where it lives                                                   | Controlled by                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Autonomy loops              | GitHub Actions workflows on schedules and events, grouped into lanes                               | `.github/workflows/` (106 files), `scripts/autonomy/`            | `.github/autonomy.json`, reconciled by `autonomy-reconcile` |
| AgentZ                      | A Python control plane: a registry of 76 workflows, three execution modes, a risk firewall, an API | `agentz/`                                                        | `agentz/workflows/registry.yaml`, `AGENTZ_MODE`, CLI flags  |
| Supervisor                  | A long-running Node loop that calls `runPipelineTick` every few minutes                            | `server/jobs/agentz-supervisor.ts`                               | `AUTONOMOUS_PIPELINE_ENABLED`, environment variables        |
| Merge autopilot and repairs | Two workflows that touch pull requests                                                             | `merge-autopilot.yml`, `ci-repair-loop.yml`, `scripts/autonomy/` | `merge_autopilot` in the manifest, the `hold` label         |

Coding assistants such as Claude Code are not part of this stack. They work through pull requests, and the autopilot treats their branches like anyone else's (section 5).

## 2. The switchboard: `.github/autonomy.json`

**(code)** Every file in `.github/workflows/` must appear exactly once in a lane, and CI enforces it. States are `on`, `off` and, for the manual lane, `manual`. `autonomy-reconcile` is meant to run on each merge to `main` and daily and to enable or disable the workflows in managed lanes until GitHub matches the file (the `manual` lane is never touched). Turning a loop on or off is an edit to this file, never a click in the Actions UI. The manifest itself classifies `autonomy-reconcile.yml` as `off` (AO-10).

Counts below were computed from the file on `main`.

| Lane      | Purpose in the manifest                                                     | Workflows | on  | off | manual |
| --------- | --------------------------------------------------------------------------- | --------- | --- | --- | ------ |
| `ship`    | build, test, scan, deploy on push                                           | 30        | 26  | 4   | 0      |
| `health`  | Loop 1: read-only probes, one `ops-alert` issue when red                    | 18        | 16  | 2   | 0      |
| `revenue` | Loop 2: warm leads to checkout, dunning, revenue report, gov digest         | 12        | 10  | 2   | 0      |
| `growth`  | Loop 3: SEO, owned social, listening, gated cold outreach                   | 9         | 5   | 4   | 0      |
| `improve` | Loop 5: Gemma suggestions on a self-hosted runner                           | 1         | 0   | 1   | 0      |
| `repair`  | Loop 4: classify failed checks, open draft fix PRs                          | 1         | 1   | 0   | 0      |
| `manual`  | secret binding, backfills, one-off sends; the reconciler does not manage it | 33        | 0   | 0   | 33     |
| `retired` | kept disabled for history                                                   | 1         | 0   | 1   | 0      |
| **Total** |                                                                             | **105**   |     |     |        |

**(code)** There are 106 workflow files. The one the manifest does not list is `deploy-manufacturer-status.yml`, which is why `scripts/__tests__/autonomy.test.ts` fails on `main` (NEXT_ACTIONS N-12). No file is listed twice and no listed file is missing.

### Off in the manifest

Every workflow classified `off`, from `.github/autonomy.json` on `main`:

| Lane      | Off                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `ship`    | `content-routine-pr.yml`, `dependabot-auto-merge.yml`, `automerge-dependabot.yml`, `autonomy-reconcile.yml` |
| `health`  | `repo-maintenance.yml`, `pipeline-tick.yml`                                                                 |
| `revenue` | `gov-mint.yml`, `affiliate-payouts.yml`                                                                     |
| `growth`  | `content-publish.yml`, `marketing-autonomous.yml`, `b2b-outreach.yml`, `weekly-video.yml`                   |
| `improve` | `gemma-loops.yml`                                                                                           |
| `retired` | `browser-vision-tasks.yml`                                                                                  |

- **`operator_hold`** (owner, 2026-10-08) is the subset the reconciler must not re-enable and the ops pulse does not page for: `b2b-outreach.yml`, `content-publish.yml`, `gov-mint.yml`, `marketing-autonomous.yml`, `pipeline-tick.yml`. Remove a name from the list before turning its loop back on.
- **`cold_outreach.enabled` is `false`** (switched off 2026-10-09 as containment, PM-420). Turning it back on needs the owner.
- `dependabot-auto-merge.yml` and `automerge-dependabot.yml` are off while `merge-autopilot.yml` is on, and `dependabot[bot]` is one of its trusted authors. That reads as a replacement, not as an oversight, but the manifest does not say so.

### Dated settings

| Setting             | Value                            | Effect                                                                                                                                                                           |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `launch_mode`       | enabled, **expires 2026-10-31**  | Until then, `agentz-orchestration` runs live lead qualification and the HubSpot sync on its daily schedule. After the date every loop falls back to its normal gate (section 7). |
| `launch_mode` limit | 90 days                          | CI rejects a longer window (`MAX_WINDOW_DAYS` in `scripts/autonomy/launch-mode.mjs`). Expiry is at 23:59:59 UTC on the date.                                                     |
| `merge_autopilot`   | enabled                          | Section 5.                                                                                                                                                                       |
| `stripe_webhooks`   | one endpoint, ten ensured events | `stripe-webhook-reconcile` only adds the listed events to `https://authichain.com/api/stripe/webhook`. See `REVENUE_LOOP.md`.                                                    |

## 3. What may run alone and what waits for the owner

From the charter, unchanged:

- **Alone:** deploy code that passed required checks through the existing Cloudflare workflows; publish SEO and content to owned channels; follow up with warm leads using the payment links in `src/lib/plans.ts`; open draft PRs with deterministic fixes; merge a trusted PR once green and clean; send cold outreach inside its rules (currently switched off).
- **Waits for the owner:** price changes, new SKUs, refunds and any Stripe write other than creating a checkout session (one narrow exception: webhook events listed in the manifest); production database migrations; DNS, Cloudflare Access, secret rotation, Vercel; any claim of a customer, partner, certification or result that cannot be verified.

When a loop meets something on the second list it opens one issue labelled `approval-needed`. The owner answers by adding `approved` or `denied`; only a label added by the owner counts (`scripts/autonomy/approvals.mjs`, `gate` for one decision, `latch` to hold a loop off until resumed). Alerts go to one issue labelled `ops-alert`, which the stack closes when it is green again.

## 4. AgentZ

### 4.1 Registry

**(code, `agentz/workflows/registry.yaml`, `agentz/core/runner.py`)** 76 workflows. Every entry has `id`, `title`, `priority`, `blocks_revenue`, `handler`, `type`, `estimated_minutes` and `requires` (credential names).

| Field                     | Entries that set it | Meaning                                                                                                                                                   |
| ------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `priority`                | 76                  | critical 22, high 38, medium 11, low 5. A scheduling hint, not a risk class.                                                                              |
| `risk_class`              | 22                  | low 10, medium 3, high 8, critical 1. The other 54 default to `low`.                                                                                      |
| `requires_human_approval` | 3                   | `qron_stripe_links`, `qron_pro_stripe_onboarding`, `qron_tokenomics_sim`                                                                                  |
| `confirm_before_run`      | 5                   | turns AUTO into CONFIRM                                                                                                                                   |
| `financial_limit_usd`     | 5                   | `launch_governor` 50, `launch_followup` 25, `launch_find_prospects` 5, `launch_prepare_outreach` 5, `launch_score_prospects` 1                            |
| `max_runs_per_day`        | 6                   | `launch_followup` 100, `architect_cycle` 4, `launch_governor` 4, `launch_find_prospects` 3, `linkedin_strainchain_outreach` 1, `launch_weekly_strategy` 1 |
| `max_retries`             | 0                   | the field exists (default 0) and no workflow sets it                                                                                                      |

### 4.2 Modes

**(code, `agentz/core/modes.py`)** `dry-run` describes each step and touches nothing. `confirm` prompts before each side effect (`y`, `N`, or `skip-all`). `auto` runs without prompting. Every side effect goes through `ExecutionContext.step`. A workflow can persist a checkpoint to `agentz/logs/checkpoints/<id>.json`.

### 4.3 Two entry points, different guards

The same handlers are reached two ways, and the guards are not the same.

| Control                                                  | CLI and API (`agentz/core/runner.py` `execute`)            | GitHub Actions (`agentz/workflows/runner.py`)             |
| -------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Default mode                                             | `confirm` (`run --all --mode auto` is refused)             | `AGENTZ_MODE`, default **`auto`**                         |
| Reads the registry entry                                 | yes                                                        | **no**; it takes only a handler name                      |
| Credential preflight (`requires`)                        | yes; live runs are blocked if any is missing               | no                                                        |
| `max_runs_per_day`                                       | yes, counted from `agentz/logs/runs.jsonl`                 | no                                                        |
| `risk_class` high or critical, `requires_human_approval` | yes; AUTO is escalated to CONFIRM                          | no; the values are fixed at `medium`, no approval         |
| `confirm_before_run`                                     | yes                                                        | no                                                        |
| `financial_limit_usd` budget check                       | **no** (see 4.4)                                           | fixed at $100 per handler per day, read from `runs.jsonl` |
| Protocol veto                                            | no                                                         | no; `protocol_veto_active` is fixed at `False`            |
| Retries                                                  | `max_retries + 1` attempts, 5 s apart; default one attempt | none                                                      |
| Writes the audit log (`runs.jsonl`)                      | yes (`write_audit_log`)                                    | no                                                        |

**(code)** The Actions entry carries its own comment: "in a production system, these would come from the registry.yaml". Three workflows call it:

| Workflow                   | Handler                       | Mode                                                                                                                                                                      |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance-audit.yml`     | `authichain_compliance_audit` | no `--mode`, so `AGENTZ_MODE`, default `auto`                                                                                                                             |
| `ghost-traffic.yml`        | `ghost_traffic_engine`        | `auto` on schedule (only if repo variable `GHOST_TRAFFIC_ENABLED` is `true`), `dry-run` on manual dispatch unless `dry_run` is unchecked. Light GET probes, no paid APIs. |
| `repo-audit-integrate.yml` | `repo_audit_integrate`        | `dry-run` only                                                                                                                                                            |

### 4.4 The risk firewall (`agentz/core/risk_firewall.py`)

**(code)** `assess_workflow` returns approved, escalated or blocked:

1. `high` and `critical` escalate AUTO to CONFIRM. `low` and `medium` do not.
2. `requires_human_approval` escalates AUTO to CONFIRM.
3. A `critical` workflow in the protocol set (`launch_protocol_gate`, `protocol_schema_validate`, `protocol_signature_verify`, `protocol_negative_fixtures`) is blocked while a ProtocolGuardian veto is active.
4. If `financial_limit_usd` is above zero and the sum of `cost_usd` over today's `ok` or `skipped` runs of that workflow in `runs.jsonl` has reached it, the run is blocked.
5. Otherwise it is approved.

The module's own comment says it "sits between the registry load and the handler dispatch in runner.execute()". **(code)** `execute` calls only `should_force_confirm` (steps 1 and 2). It does not call `assess_workflow`, so a registry `financial_limit_usd` is not enforced on the CLI path. The only callers of `assess_workflow` are the Actions entry (fixed arguments), the launch governor (`agentz/core/governor.py`, which passes the registry entry's `risk_class`, `financial_limit_usd`, `requires_human_approval` and a real `veto_active`) and `left_brain.py`.

**(code)** `agentz/logs/` is in `.gitignore`. The budget and rate-limit checks therefore read a file that exists only on the host that wrote it. On a fresh Actions checkout it does not exist, the spend reads as $0, and the Actions entry never writes to it.

### 4.5 Retry bounds

Only these are set in code:

| Where                                           | Bound                                                                                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry runner, per workflow                   | `max_retries + 1` attempts, fixed 5 s sleep between them. `max_retries` is 0 for all 76 workflows, so one attempt.                                                                                 |
| `RobustAgent` (`agentz/core/resilience.py`)     | `max_steps` 10, `max_retries_per_action` 2, `stagnation_threshold` 3, `repetition_threshold` 2, `step_delay` 1.0 s. A failed action after its retries is logged and the plan continues.            |
| LLM clients (`agentz/core/llm.py`)              | `max_retries=1` for the hosted providers, `max_retries=0` for the local server (timeout from configuration).                                                                                       |
| Supervisor (`server/jobs/agentz-supervisor.ts`) | After a failed tick, wait `AGENTZ_FAILURE_BACKOFF_SECONDS` (default 60) times `min(consecutive failures, 10)` seconds, so 600 s at most, then try again without limit. A success resets the count. |

The Actions entry, `verified_outreach_sequence` and the launch governor have no retry loop of their own that I found.

### 4.6 Idempotency

Only where a line of code does it:

| Where                                                 | Mechanism                                                                                                                           | Limit                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `add_pending_dm` (`agentz/core/outreach.py`)          | Ignored if the same `lead_name` is already `pending` or the same payload fingerprint exists. A file lock covers the read-and-write. | Per host file.                                                                     |
| Left-brain decisions (`agentz/core/left_brain.py`)    | `decision_id` (supplied, or the JSON of action and gate context); a repeat returns `idempotent_skip`.                               | The set of applied ids is in memory, so it lasts for one process.                  |
| `verified_outreach_sequence`                          | Skips a second deal that guesses the same address within one run.                                                                   | One run only.                                                                      |
| Supervisor lock (`.agentz.lock`, created with `wx`)   | A second supervisor refuses to start; a stale lock must be removed by hand.                                                         | One host.                                                                          |
| OpenClaw `notify` (`agentz/integrations/openclaw.py`) | Sends `idempotency_key = "agentz-" + 12 hex characters of a fresh UUID`.                                                            | The key is new on every call, so a retried call is not recognised as the same one. |

Payments, webhooks and checkout have their own keys; they are in `REVENUE_LOOP.md`.

### 4.7 API (`agentz/api/main.py`, run with `uvicorn agentz.api.main:app`)

**(code)** Public: `/health`, `/scout/{city}`, `/products`, `/marketplace`, `/network/pulses`, `/network/summary`, `/results`. Behind `verify_token`: `/scan`, `/redeem`, `/agents`, `/workflows`, `POST /workflows/{id}/run`, `/architect/cycle`, `/credentials/{key}` (write and status), `/launch/state`, `/launch/score`, `/launch/governor/cycle`, `/launch/specialists`. `AGENT_SECRET` unset makes every token route answer 503 (it fails closed). `$QRON` rewards on `/scan` and redemptions on `/redeem` are simulated and say so; nothing is minted or burned.

### 4.8 Where AgentZ runs

AgentZ runs on the owner's LAN behind a tunnel (`agentz.authichain.com`; the orchestration workflow's comments say so). **(not verified)** Whether the host is up cannot be read from the repository. In launch mode its being offline does not turn the revenue loop red (`continue-on-error`); the failed step stays visible.

## 5. Merge autopilot

**(code, `scripts/autonomy/merge-autopilot.mjs`, `docs/OPERATING_CHARTER.md`)**

- **Eligible:** a PR into `main` from a branch in this repository whose author is in `trusted_authors` (`undone0603`, `dependabot[bot]`). A draft, a fork, any other author, or a PR with the label `hold` or `do-not-merge` is skipped.
- **Green and clean:** every check run on the head finished as success, neutral or skipped; every commit status is success; GitHub reports the PR `clean`. Red, pending or cancelled means wait.
- **Behind `main`:** it merges `main` into the branch (never a rebase) and waits for CI on the result.
- **Merge:** a squash merge pinned to the checked head SHA, so a push that lands mid-check is not merged unseen.
- **Scope:** every path, including security, revenue, schema and the charter (owner decision 2026-10-02). `CODEOWNERS` still requires `@undone0603` on billing, Stripe, auth, schema, contracts and workflows.
- **Token:** needs `MERGE_AUTOPILOT_TOKEN`; without it, the default Actions token starts no workflows for the autopilot's own commits.

**What this means for this review's pull requests.** They were opened with the owner's credentials, so their author is a trusted one, and they are drafts, which the autopilot skips. Marking one ready makes it eligible. #1996 carries the `hold` label and stays out; #1995 and #1997 do not, so they will merge on their own once ready, green and clean. While GitHub Actions is billing-locked (BLOCKERS B-4) no check can go green.

## 6. Outreach controls

The charter's rules, with where each is enforced. **(not verified)** that the live send path applies them all; the code references are the starting points.

| Control    | Rule                                                                                                                                                                                        | Where                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Two keys   | A scheduled live send needs `cold_outreach.enabled: true` **and** repo variable `OWNER_LIVE_SEND=true`.                                                                                     | manifest, workflow                              |
| Cap        | At most 10 new prospects a weekday run (25 in launch mode). Segments `qron`, `strainchain`, `govchain` rotate by weekday; never `all`, `partners`, `high_leverage`.                         | manifest, `launch-mode.mjs`                     |
| Follow-ups | At most 1 per prospect.                                                                                                                                                                     | manifest                                        |
| Breaker    | Last 7 days of Resend events; dry run if bounce rate is above 3% (from 10 sends) or there is one complaint; fails closed if Resend cannot be read. A trip latches until the owner approves. | `deliverability-breaker.mjs`, `approvals.mjs`   |
| Send guard | Verified or opt-in addresses only; no guessed addresses, no role inboxes; MX check; CAN-SPAM footer and address; recordable opt-out; send-history dedupe.                                   | `server/outreach/send-guard.ts` (`guardedSend`) |
| Opt-out    | A live send first runs `scripts/outreach-optout-check.ts`; with no recordable opt-out it stays a dry run.                                                                                   | `scripts/outreach-optout-check.ts`              |

**(code)** `agentz/workflows/handlers/verified_outreach_sequence.py` builds the address it emails as `info@<guessed domain>` and does not call the TypeScript send guard. It checks Resend's `delivered` status afterwards, de-duplicates within a run, adds a CAN-SPAM footer and pauses between sends. It is not in the registry and no workflow runs it, so it can only be started by hand (`python -m agentz.workflows.runner --handler verified_outreach_sequence`). It is the opposite of the charter's "no guessed addresses and no role inboxes" (question AO-6).

## 7. Dates that change behaviour

| Date           | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2026-10-31** | `launch_mode.expires`. From 2026-11-01 00:00 UTC: scheduled `agentz-orchestration` runs dry-run instead of live qualification and HubSpot sync; the AgentZ LAN ping step is no longer `continue-on-error`, so an offline AgentZ fails the run; `gov-engine`'s scheduled notify to the owner Slack channel goes dry (its ingest was already live, and score, proposals and mint were never live on schedule); `b2b-outreach` would use `max_new_prospects_per_day` (10) instead of 25, but it is on `operator_hold` and `cold_outreach` is off, so nothing sends either way. |
| 2026-11-20     | GitLab Ultimate trial ends; pull mirroring stops (`GITLAB_MIGRATION.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

To extend launch mode the owner edits `expires` (at most 90 days from the window start) and merges.

## 8. Open questions

| ID    | Question                                                                                                                                                                                                                                                                                                                                                                                                    | Where                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| AO-1  | The Actions entry runs any handler in `auto` with fixed risk arguments and ignores the registry. Should it load the registry entry (as the governor does), and refuse a handler that is not in the registry?                                                                                                                                                                                                | `agentz/workflows/runner.py`                                          |
| AO-2  | The CLI runner enforces escalation and the daily run count but not `financial_limit_usd`; the Actions runner has a $100 fixed limit that reads a file that does not exist on a fresh checkout. Is any budget cap actually enforced for a scheduled run?                                                                                                                                                     | `agentz/core/runner.py`, `agentz/core/risk_firewall.py`, `.gitignore` |
| AO-3  | `max_retries` is 0 for all 76 workflows. Is one attempt the intended policy for the workflows that call external services?                                                                                                                                                                                                                                                                                  | `registry.yaml`                                                       |
| AO-4  | The OpenClaw notify key is new on every call. If the intent is "do not send the same notification twice on retry", the key should derive from the content or the event.                                                                                                                                                                                                                                     | `agentz/integrations/openclaw.py`                                     |
| AO-5  | `launch_mode` expires on 2026-10-31. Does the owner want it extended, or to let the loops tighten? Revenue qualification and the HubSpot sync go back to dry-run on schedule.                                                                                                                                                                                                                               | `.github/autonomy.json`                                               |
| AO-6  | `verified_outreach_sequence` guesses `info@` addresses outside the send guard. Delete it, route it through `guardedSend`, or leave it with a header saying it must not be used for live sends.                                                                                                                                                                                                              | `agentz/workflows/handlers/verified_outreach_sequence.py`             |
| AO-7  | `deploy-manufacturer-status.yml` is unclassified (N-12).                                                                                                                                                                                                                                                                                                                                                    | `.github/autonomy.json`                                               |
| AO-8  | The autopilot will merge #1995 and #1997 once they are ready, green and clean. Should either carry `hold` until the owner has read it?                                                                                                                                                                                                                                                                      | PR labels                                                             |
| AO-9  | Nothing records whether AgentZ on the owner's LAN is up. Is there a heartbeat the ops pulse reads, other than the daily ping?                                                                                                                                                                                                                                                                               | `agentz-orchestration.yml`, `ops-pulse.yml`                           |
| AO-10 | `autonomy-reconcile.yml` is classified `off` in a managed lane, and `reconcile.mjs` has no exception for itself. If it applies its own plan it disables itself, and the PR classification check inside it stops running (the same check also runs as `scripts/__tests__/autonomy.test.ts`). Was `off` intended, or is it a mistake that has not bitten yet? Live state is not readable from the repository. | `.github/autonomy.json`, `scripts/autonomy/reconcile.mjs`             |

## 9. How to check this

1. Run `node scripts/autonomy/launch-mode.mjs` on `main`: it prints whether launch mode is active and the days left (10 on 2026-10-22, counted to 23:59:59 UTC on the 31st).
2. Run `python -m agentz.cli list` and compare the count with the 76 here.
3. For AO-1 and AO-2, run `python -m agentz.workflows.runner --handler ghost_traffic_engine --mode dry-run` twice from a clean checkout and confirm that neither run writes `agentz/logs/runs.jsonl`.
4. For AO-8, list `gh api repos/undone0603/authichain-unified/pulls/1995 --jq '.labels'`.
