# AgentZ orchestration — dry-run enablement

Owner mandate 2026-09-19: AgentZ is live on the **$0** path
(`https://agentz.authichain.com` named Cloudflare Tunnel → uvicorn).
claw at `https://claw.authichain.com` reports `agentz_api: configured`.
`OWNER_LIVE_SEND` may already be `true` for **email-proposals / b2b-outreach**.
That var does **not** flip AgentZ to `auto` or send mail from this workflow.

This is the thaw of **`agentz-orchestration.yml` only**. It is not a thaw of
`content-publish`, genesis cold send, or `gov-*`.

Do **not** invent `OPENCLAW_GATEWAY_URL`. Do **not** deploy
`authichain-agentz` Containers / Workers Paid.

## What is enabled

| Path | Behavior after this enable |
| --- | --- |
| `.github/workflows/agentz-orchestration.yml` | Daily 08:00 UTC + `workflow_dispatch`. Schedule is **always dry-run**. |
| Phase 0 `ping-claw-agentz` | `GET https://claw.authichain.com/health` and `GET https://agentz.authichain.com/health`. If an Actions bearer secret exists, `POST https://claw.authichain.com/architect/cycle` with `mode=dry-run` only. |
| `qualify-leads` | AI scoring. DB writes only when dispatch `dry_run=false`. |
| `sync-mi-leads` | HubSpot CSV sync. **Skipped** on dry-run (script does not honor `DRY_RUN`). |
| `funnel-report` | Read-only. |
| `/api/agentz/webhook` | Logging heartbeat on `APP_URL` (default `https://authichain.com`). |
| Genesis cron `GET /api/automation/cron` | **Unchanged.** Outbound stays `skipped_public_loop_freeze`. |
| AgentZ registry CLI (`run --all --mode auto`) | Still refused. This workflow does not run outreach handlers. |
| `content-publish` | Still frozen. |

`scripts/ops/ping_claw_agentz.py` is the Phase 0 helper. It refuses `--mode auto`
and does not set `OPENCLAW_GATEWAY_URL`.

## Enable the workflow (owner token)

This cloud-agent token cannot `PUT .../enable` (Actions API 403). An owner
token with `actions: write`:

```bash
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/307144845/enable
```

UI: **Actions → AgentZ — Autonomous Sales & Lead Orchestration → … → Enable workflow**.

## Smoke dispatch (do this first)

After the workflow is enabled **and this PR is on `main`**:

```bash
gh workflow run agentz-orchestration.yml --ref main -f dry_run=true -f ping_agentz=true
```

UI: **Actions → AgentZ — Autonomous Sales & Lead Orchestration → Run workflow**

| Input | Value | Why |
| --- | --- | --- |
| `dry_run` | **checked / `true`** | No lead-table writes, no HubSpot sync |
| `ping_agentz` | **checked / `true`** | Hits live claw + AgentZ `/health`; architect dry-run if a bearer secret is set |

Expect: Phase 0 prints claw `agentz_api: configured` and AgentZ
`{"status":"sovereign","network":"Polygon"}`. Architect is skipped with a
notice if no Actions bearer secret is present.

Do **not** uncheck `dry_run` until one dry-run log is green.

## Later: live qualify / HubSpot only

```bash
gh workflow run agentz-orchestration.yml --ref main -f dry_run=false -f ping_agentz=true
```

That writes qualified leads and may push the MI cannabis CSV to HubSpot.
AgentZ architect **stays dry-run**. It does not run `hot_lead_outreach_blitz`
or any AgentZ email handler.

## Remaining owner secrets (names only)

Already used by this workflow (must exist for qualify + webhook):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HUBSPOT_TOKEN` or `HUBSPOT_ACCESS_TOKEN`
- `AGENTZ_WEBHOOK_SECRET`

For architect dry-run via claw (optional; health still runs without them):

- `OPENCLAW_API_KEY` **or** `AGENTZ_API_KEY` **or** `AGENT_SECRET`
  (same value family as claw Worker `AGENTZ_API_KEY` / local uvicorn `AGENT_SECRET`)

If `/health` starts 302ing to `strainchainexecutiveteam.cloudflareaccess.com`
from Actions:

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Do **not** invent:

- `OPENCLAW_GATEWAY_URL` (owner-set reachable OpenClaw Node only)

Do **not** set for this enablement:

- Workers Paid / Containers secrets on `authichain-agentz`
