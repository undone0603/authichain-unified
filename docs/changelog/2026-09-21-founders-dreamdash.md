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
