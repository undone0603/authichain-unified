# AI Adapt bot fleet: silence alarm

_Added 2026-11-05, rebuilt from the AI Adapt archive v2 hardening plan of
2026-10-14 (Phase 2). Read-only. It changes no bot, prompt, or database
object._

## Why

All six fleet bots (archive, research, chief-of-staff, inbox-triage,
revenue-pulse, govchain-bid-scorer) logged nothing from 2026-10-09 to
2026-10-13. A watchdog that runs inside the same Claude fleet cannot report a
fleet-wide outage. The pg_cron heartbeat (`public.ai_adapt_heartbeat()`, job
`ai-adapt-heartbeat`, `23 */6 * * *`) detects the gap, but on its own it can
only write to `ops_bot_log`, and its Resend email is not configured.

## What runs

`scripts/autonomy/bot-fleet-watch.mjs` is called by the hourly **Ops pulse**
(`.github/workflows/ops-pulse.yml`, Loop 1), with the Supabase read secrets
that job already holds. It makes one PostgREST `GET` on `public.ops_bot_log`
and is red when:

- a bot in `.github/autonomy.json` under `bot_fleet.bots` has no row of any
  status in the last `silence_hours` (36), or
- `ai-adapt-heartbeat` logged a `fail` row in the last
  `heartbeat_lookback_hours` (7; the cron fires every 6h).

A red result is added to the single `ops-alert` issue, as
`fleet:<bot>:<kind>`. GitHub emails the owner about that issue, so the alarm
does not depend on Resend. The issue closes itself on the next green pulse.

If the read cannot happen (missing secrets, HTTP error), the watch reports
`bot_fleet (unverified)`. That is never treated as healthy. The issue body
never includes error text.

## Operate

| Task                | How                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Add or retire a bot | Edit `bot_fleet.bots` in `.github/autonomy.json` and merge.                                               |
| Change the limit    | Edit `silence_hours`.                                                                                     |
| Check by hand       | `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/autonomy/bot-fleet-watch.mjs` (exit 1 when red). |
| Tests               | `node --test scripts/autonomy/bot-fleet-watch.test.mjs`                                                   |

The fleet list matches the `bot` values in `ops_bot_log` as read on
2026-11-05. The heartbeat is deliberately **not** in the silence list,
because it only logs when it fires.

## Expected on merge

Every bot in the list had logged a run within the previous 24h when this was
checked (2026-11-05 06:00 UTC), so the first pulse should not page for
silence. The heartbeat last logged at 2026-11-04 06:23 UTC, which is outside
the 7h window.

## Not included (from the 10-14 plan)

- Recording the three 2026-10-14 remote-only migrations in
  `supabase/migrations` and refreshing `REMOTE_APPLIED_VERSIONS.txt`. This
  needs the exact remote statements and is a separate change.
- The AgentZ `ai_adapt_archive_health` workflow.
