# Guardrail/Caps Layer — Design Spec

**Date:** 2026-07-29
**Status:** Approved by owner, pending implementation plan
**Sub-project 1 of 5** in the "self-running AI business" roadmap (see context below). Later sub-projects (outreach repair, SEO/content engine, partnerships, licensing wiring) all depend on this existing first.

## Context

The estate (AuthiChain as flagship brand; QRON/StrainChain/GovChain as secondary) has working monetization plumbing (21 live Stripe payment links, a B2B `licensing_closer` subagent) but zero revenue to date — the audited constraint is traffic, not payment infrastructure. The owner wants the business to run with **full autonomy within hard caps**: no per-action human approval (including for licensing_closer's contract-value actions — the owner explicitly chose to drop its prior "founder must approve" gate), reviewed via dashboard/alerts instead. Ad/tool spend ceiling is fixed at **$0** — no paid channels are in scope for autonomous spend.

Today there is no unified caps/suppression/kill-switch layer. Three disconnected mechanisms exist:
- `agentz/core/runner.py` — a real, working per-workflow rate limiter (`max_runs_per_day`, JSONL-file-based, single-process, scoped to one workflow at a time — no cross-workflow or cross-channel concept).
- `services/workers/qron-outreach` — a Cloudflare KV-based bounce/suppression list, siloed to that one worker (its own `wrangler.toml` KV binding; `ops/scripts/b2b-cold-outreach.ts` sends via Resend with no suppression check at all).
- Env-var kill switches (`AUTONOMOUS_PIPELINE_ENABLED`, `REQUIRE_OUTREACH_APPROVAL`, `REQUIRE_DEV_APPROVAL` in `server/_core/env.ts`) — real and checked, but narrow/hardcoded per-feature, not a general mechanism.

Separately, `automation_logs` (Drizzle table) + `/admin/ops` (`src/app/admin/ops/page.tsx` + `src/app/api/admin/ops/route.ts`) already exist as a generic, admin-authed event ledger and dashboard — this design extends rather than replaces them.

The live high-volume sender (`qron-drip-sequence` via Supabase pg_cron `automation-orchestrator`) is **not in this repo** — it lives directly in Supabase as an edge function. Integrating it is flagged as an external follow-up, not something implementable from this codebase alone.

## Goals

- One shared enforcement point that any current or future automation (CF workers, Supabase pg_cron/edge functions, agentz, the Node app itself) checks before taking any external-effect action (send email, send contract, spend money, publish content).
- Fail-closed: an outage or misconfiguration stops sending, never silently bypasses caps.
- No per-action human approval anywhere (including licensing) — safety comes from caps + suppression + auto-tripping kill switches + a daily summary email, not a human in the loop per send.
- $0 spend enforced as a hard channel property, not a convention.

## Non-goals

- Rebuilding or replacing the existing per-workflow agentz limiter, the `automation_logs` table, or the env-var kill switches — this layer adds a cross-channel enforcement point and can coexist with them (agentz keeps its local check as defense-in-depth).
- Migrating or editing the Supabase-only `qron-drip-sequence` edge function (out of repo, flagged as external follow-up).
- Any paid-ad or spend-bearing channel (ceiling is $0; a spend-capable channel type is not built in this phase).

## Architecture

A new module in the existing Node app, `server/guardrail/`, backed by new tables in the same Supabase Postgres the app already connects to (via the existing `server/db.ts` / Drizzle setup). Exposed as Next.js API routes under `/api/guardrail/*`, authenticated by a single shared `GUARDRAIL_API_KEY` env var (distributed to CF workers as a Wrangler secret, to agentz via its `.env`, same pattern as other cross-service secrets already in use).

Every sender — current (CF worker `qron-outreach`, `b2b-cold-outreach.ts`, agentz workflows) and future (SEO/content publish, partnership outreach) — calls `POST /api/guardrail/check` before firing and `POST /api/guardrail/record` after. If the guardrail API is unreachable, times out, or returns anything other than an explicit `allowed: true`, the caller treats it as denied.

## Data model

New Drizzle tables, migrated the same way existing schema changes have been (additive migration against the live Supabase project):

- **`guardrail_channels`** — `id`, `name` (e.g. `email.qron-drip`, `email.b2b-cold`, `content.publish`, `licensing.docusign`, `partnership.outreach`), `category` (`email`|`content`|`contract`|`spend`), `daily_cap` (int), `enabled` (bool), `spend_ceiling_cents` (int, default 0 — enforced as hard 0 unless explicitly changed by the owner directly in the DB, not via any API route in this phase), `description`. New channels must have a row here before anything can send through them — no implicit default channel.
- **`guardrail_counters`** — `channel_id`, `day` (date, UTC), `count` (int). Upserted via `INSERT … ON CONFLICT (channel_id, day) DO UPDATE SET count = count + $n` inside the same transaction as the cap check, so the check-and-increment is atomic under concurrent callers.
- **`suppression_list`** — `email`, `reason` (`bounced`|`complained`|`manual`|`unsubscribed`), `source`, `created_at`. Seeded at implementation time from the existing `qron-outreach` KV list (one-time migration read).
- **`kill_switches`** — `id`, `scope` (`global` or a channel name), `enabled` (bool, true = tripped/blocked), `reason`, `updated_by` (`system` or an identifier), `updated_at`.
- **`guardrail_events`** — append-only: `channel_id`, `action` (`check`|`record`|`suppress`|`kill_toggle`), `allowed` (bool, nullable), `reason`, `metadata` (jsonb), `created_at`. This is both the audit trail and the anomaly-detection input.

## API surface

- **`POST /api/guardrail/check`** — body `{ channel: string, count?: number (default 1), recipient?: string }`. Order of checks: global kill switch → channel kill switch → channel `enabled` → (if `recipient` given) not in `suppression_list` → `counters[channel][today] + count <= daily_cap`. On allow, atomically increments the counter in the same statement. Returns `{ allowed: boolean, remaining: number, reason?: string }`.
- **`POST /api/guardrail/record`** — body `{ channel: string, action: string, allowed: boolean, reason?: string, metadata?: object }`. Pure logging into `guardrail_events`; does not touch counters (counters are only touched at `check`-time, so retries after a downstream failure don't get a free extra slot).
- **`GET /api/guardrail/status`** — admin-authed (reuses the existing `requireAdmin` pattern from `/api/admin/ops`). Returns per-channel today's count/cap, kill-switch states, suppression list size, recent events. Feeds the dashboard.
- **`POST /api/guardrail/suppress`** — body `{ email: string, reason: string, source: string }`. Called by the existing Resend bounce webhook (extended to call this in addition to/instead of the CF worker's own KV write) and available for manual suppression.
- **`POST /api/guardrail/kill`** — admin-authed. Body `{ scope: string ("global" or a channel name), enabled: boolean, reason: string }`. The owner's manual override lever.

## Anomaly detection / auto-trip

A scheduled Vercel cron job (daily, consistent with the existing Hobby-plan daily-cron constraint noted in prior stabilization work) evaluates `guardrail_events` per channel over a rolling 24h window and auto-trips that channel's `kill_switches` row (via the same code path as a manual kill, `updated_by: "system"`) if:
- bounce/complaint rate > 10% of sends in the window, or
- send volume > 3x the channel's trailing 7-day daily average.

This is the substitute for per-action human approval: the system polices itself, and only surfaces to the owner via the daily summary email and dashboard once something has already been stopped.

## Alerting

A daily summary email (via the existing Resend integration, sent directly — not itself routed through its own guardrail check, since it's a report, not outreach) covering: per-channel volume vs. cap, any denials, any auto-trips and why, current suppression list size. This is the primary review surface given there's no per-action approval step.

## Dashboard

Extend `/admin/ops` (or add a sibling `/admin/guardrail` page reusing its layout/auth) to show: per-channel today's usage vs. cap, kill-switch states with manual toggle buttons calling `/api/guardrail/kill`, suppression list (recent additions, manual-add form), and a feed of recent `guardrail_events` (especially denials and auto-trips).

## Error handling

Fail-closed throughout: unreachable guardrail API, an unrecognized channel name, or any ambiguous/error state all resolve to `allowed: false`. No implicit allow-by-default path exists anywhere in `check`.

## Integration follow-ups (not built in this phase, but the design accounts for them)

- CF worker `qron-outreach`: replace its local KV suppression check with a `check` HTTP call; bounce webhook calls `/suppress`.
- `ops/scripts/b2b-cold-outreach.ts`: currently fully unguarded — add check/record calls.
- agentz: add an HTTP check call alongside (not replacing) its existing local `max_runs_per_day` limiter.
- Supabase `qron-drip-sequence` edge function: needs the same integration, but its source isn't in this repo — flagged as an external task, likely for whoever/whatever maintains that Supabase project directly.

## Testing

- Vitest unit tests for the check/record logic and the anomaly evaluator (synthetic `guardrail_events` data crossing/not crossing thresholds).
- A concurrency test asserting two simultaneous `check` calls against a near-exhausted cap can't both succeed.
- Manual curl smoke test against a preview deploy before merging to main.
