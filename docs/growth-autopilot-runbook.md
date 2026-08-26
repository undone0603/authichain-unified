# Growth Autopilot — Go-Live Runbook

How the traffic + income workflows fit together, and the exact order to switch
them on safely. Owner throws the final switches; the guardrails below keep
"autopilot" legitimate (verified/opt-in recipients only, CAN-SPAM compliant,
rate-gated, human-approvable).

---

## 1. The engine at a glance

| Layer | Workflow(s) | Cadence | Contacts people? | Spends? |
| --- | --- | --- | --- | --- |
| **Traffic — owned** | `gen-seo-pages.yml` | Fri 09:00 UTC | No | LLM |
| | `ghost-traffic.yml` | daily 13:00 | No | small |
| | `reddit-monitor.yml` | every 6 h | No (read) | LLM |
| | `marketing-autonomous.yml` | Mon 14:00 | posts to owned social | LLM/social |
| **Income — gov (public data)** | `gov-engine.yml` → ingest→score→proposals→mint→notify | daily 06:00 | drafts only | LLM |
| **Income — outbound** | `agentz-orchestration.yml` | daily 08:00 | **yes** | LLM/email |
| | `autonomous-business-cycle.yml` | daily 00:00 | **yes** | LLM/email |
| | `b2b-outreach.yml` | Mon 14:00 | **yes** | email |
| | `outreach-trigger.yml` | every 4 h | **yes** | email |
| | `dpp-outreach-trigger.yml` | every 8 h | **yes** | email |
| | `email-proposals.yml` | weekdays 15:00 | **yes** | email |
| **Safety** | `guardrail-digest.yml`, `verify-integrations.yml`, `compliance-audit.yml`, `security-scan.yml` | daily/weekly | — | — |

Everything outbound is inert until `AUTONOMOUS_PIPELINE_ENABLED=true`.

## 2. Guardrails (already enforced in code)

- **Provenance gate** (`server/outreach/send-guard.ts`): only `apollo_verified`,
  `reacher_verified`, `inbound_optin`, `confirmed_reply` recipients are emailed.
  `pattern_guess` / `scraped` addresses and role inboxes (`info@`, `sales@`…)
  are **rejected**. This is the core anti-spam defense.
- **CAN-SPAM**: mandatory unsubscribe footer + `List-Unsubscribe` header, and a
  **fail-closed** physical address — no `MAILING_ADDRESS` configured ⇒ **no send**.
- **Human approval**: `REQUIRE_OUTREACH_APPROVAL=true` makes agents save drafts
  (`WAITING_HUMAN`) instead of sending. Recommended for the first 1–2 weeks.
- **MX check** before every send; Resend key required.

## 3. Pre-flight config (set before enabling outbound)

Required secrets/env (Vercel + GitHub Actions):

- [ ] `MAILING_ADDRESS` — real physical postal address (else outbound fails closed)
- [ ] `UNSUBSCRIBE_URL` — working unsubscribe endpoint
- [ ] `RESEND_API_KEY`, `RESEND_FROM` — verified sending domain (SPF/DKIM/DMARC)
- [ ] `APOLLO_API_KEY` — so recipients are provenance-verified (not guessed)
- [ ] `CRON_SECRET` — bearer for `/api/cron/*`
- [ ] `REQUIRE_OUTREACH_APPROVAL=true` — start in review mode

## 4. Go-live order (each step reversible)

1. **Traffic first (zero people-risk).** Confirm `gen-seo-pages.yml` and
   `ghost-traffic.yml` run green. Organic pages compound with no downside.
2. **Gov drafts.** Let `gov-engine.yml` produce scored opportunities + proposal
   drafts. Review output; nothing is sent.
3. **Outbound in review mode.** Set config in §3 with
   `REQUIRE_OUTREACH_APPROVAL=true`, then `AUTONOMOUS_PIPELINE_ENABLED=true`
   (run `set-pipeline-enabled.yml`). Agents will queue drafts, not send.
4. **Approve a first batch by hand.** Confirm deliverability, copy, and that the
   provenance gate is rejecting junk. Watch `guardrail-digest.yml`.
5. **Flip to autosend.** Set `REQUIRE_OUTREACH_APPROVAL=false` once the drafts
   look right. Keep daily volume modest to protect domain reputation.

## 5. Kill switch

- `AUTONOMOUS_PIPELINE_ENABLED=false` (or re-run `set-pipeline-enabled.yml`
  with the flag off) halts all outbound immediately.
- Revoke `RESEND_API_KEY` for a hard stop.

## 6. Watch these KPIs

- Traffic: indexed `/p/*` pages, organic sessions, scan→signup rate.
- Revenue: checkout conversion, MRR, trial→paid.
- Deliverability/health: bounce & spam-complaint rate (keep complaints < 0.1%),
  unsubscribe rate, `guardrail-digest` rejections.
