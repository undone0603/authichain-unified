# 2026-09-21 — Founders DreamDash restore

Restore `/founders` as an auth-gated deal command center (Today / Board / Ops).

- Recreates `/founders` and `/api/founders/{dashboard,cycle,leads}`.
- Wires to existing `lead_captures` (extras in `metadata` JSON). Does not replace `/admin/leads`.
- Cycle writes `automation_logs`. Capture merges duplicate emails (+6) and auto-qualifies ≥70.
- Local SAM catalog + local AgentZ closer KB only. No 30s poll, Slack webhook, live SAM API, or streaming chat.
- Empty pipeline is valid. No seed / fake MSO rows.
- Cycle stale follow-ups set `draftPending`. Queue + Open opens the lead sheet.
- `metadata` accepts jsonb objects or text JSON.
- Do not merge until reviewed. Do not set `live=true` on AgentZ workflows.

## 2026-09-21 — draft/notify + sitemap

- Cycle logs each heartbeat workflow separately, then the summary row.
- `draftPending` flips notify founder-only (ntfy `zk_live_alerts_99`, optional Resend to authichain@ + undone.k@). Never emails the lead.
- POST `/api/founders/digest` compiles + alerts the founder. Ops "Compile digest" calls it.
- Edge `POST /api/dpp/publish` and `GET/POST /api/dpp/verify` already mounted; added POST verify tests.
- Sitemap keeps `/dpp` `/onboard` `/verify` and adds `/telegram`.
