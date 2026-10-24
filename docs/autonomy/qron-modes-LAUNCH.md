# Autonomous Launch Runbook — QRON Modes (#2047)

## Authority
Full production launch authority granted. Follow end-to-end revenue.

## Steps
1. Final applyMode wire-up + rename (Stellar Art / Batch Create / Limited Drop) + drop Launch.
2. Local Runner vitest (CI workaround).
3. Research / Auditor / Advisor gates on exact SHA.
4. Merge via GitHub.
5. Deploy via .github/workflows/deploy-cloudflare.yml.
6. Post-deploy: monitor Cron + UTM + soft-prompt clicks. ntfy on low usage or errors.

## Observability
- Structured logs: modeId, corePct
- Alerts: ntfy on <5% or 502 spikes
- Self-heal: existing generate retries + one backoff in image proxy

## Cost
$0. Eliminates founder from launch and monitoring loops.

## Human actions
None remaining for this ship.
