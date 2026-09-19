# Genesis cron — safe autonomous tick

`GET /api/automation/cron` is the agentic economy’s **safe** weekday tick: daily maintenance plus a read of `fee_flows` / brands staking. Outbound AgentZ, outreach, and gov-mint stay skipped (`PUBLIC_LOOP_FREEZE`).

## What fires it

`.github/workflows/genesis-cron.yml` curls `https://authichain.com/api/automation/cron` every 6 hours Monday–Friday UTC, and on `workflow_dispatch`. The job fails unless the response is HTTP 200 with `"status":"genesis"`.

This is the scheduled path. `autonomous-business-cycle.yml` retired its schedule (2026-09-08) and is dispatch-only. `worker-app/wrangler.toml` hourly `[triggers]` stay **commented** on purpose — do not uncomment GROUP B (or the hourly dispatcher) to “replace” this tick.

## Owner note: `CRON_SECRET` parity

The GitHub Actions secret `CRON_SECRET` must match the Cloudflare Worker secret on **authichain-edge-router**. If either side is rotated, update the other or the job 401s.

## Freeze

Do not use this workflow to enable frozen outreach, AgentZ, or `gov-mint.yml`. See `docs/operations/PUBLIC_LOOP_FREEZE.md`.
