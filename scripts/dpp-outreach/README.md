# DPP continuous outreach (decision-makers only)

## Loop (live)

| Cadence | Owner | What |
|---|---|---|
| **Daily 13:00 local** | `authichain-outreach-research.timer` | Research stubs → quality gate → promote verified DMs into Worker queue |
| **Hourly** | Cloudflare Worker cron | Send (cap 10/day) → Gmail reply poll → nurture/suppress → 3-day follow-up |

From/Reply-To: `undone.k@gmail.com` (never noreply).

## Hard rules

1. **Named human** required (`Hi Erik`, not `Hi Operations Director`).
2. **No role inboxes** (`info@`, `ops@`, `compliance@`, …) — rejected at enqueue + send.
3. **Trusted provenance** only: `apollo_verified`, `published_contact`, `manual_verified`, `reacher_verified`, `inbound_optin`, `confirmed_reply`.
4. **MX must resolve** before `verified`.
5. Daily send cap **10** (Worker secret `OUTREACH_DAILY_CAP`).

## Files

| Path | Purpose |
|---|---|
| `targets.csv` | Companies to research (ICP + LinkedIn query seeds) |
| `pipeline/researched.csv` | Staging: `needs_research` → `candidate` → `verified` / `rejected` |
| `warm-10.csv` | Snapshot of verified DMs (auto-written by promote) |
| `lib/quality-gate.mjs` | Shared gate |
| `research-dms.mjs` | Daily research / re-score |
| `add-dm.mjs` | Add one researched DM |
| `promote-and-enqueue.mjs` | Verified → Worker queue (respects remaining cap) |
| `daily-tick.mjs` / `run-daily-tick.sh` | Orchestrator for systemd |

## Add a researched decision maker

```bash
cd /home/zac/projects/authichain-unified

node scripts/dpp-outreach/add-dm.mjs \
  --company "Asket" \
  --domain asket.com \
  --name "First Last" \
  --role "Head of Sustainability" \
  --email first.last@asket.com \
  --source published_contact \
  --angle "EU textile DPP readiness 2027-28" \
  --notes "Source: company sustainability page YYYY-MM-DD"

# Then promote (or wait for 13:00 UTC timer)
CRON_SECRET=… node scripts/dpp-outreach/promote-and-enqueue.mjs
```

### Apollo (optional)

```bash
export APOLLO_API_KEY=…
node scripts/dpp-outreach/research-dms.mjs --apollo
```

Only Apollo `email_status=verified` (unlocked) becomes `apollo_verified`. Guessed / locked emails stay `needs_research`.

## Manual daily tick

```bash
./scripts/dpp-outreach/run-daily-tick.sh
# or force a send/reply cycle after promote:
RUN_CYCLE=1 ./scripts/dpp-outreach/run-daily-tick.sh
```

## Admin (Bearer `CRON_SECRET`)

- `GET /admin/outreach/status`
- `POST /admin/outreach/enqueue`
- `POST /admin/outreach/run`
- `POST /admin/outreach/reply`

## Research checklist (per target)

1. LinkedIn People search using `linkedin_query` from `researched.csv`
2. Confirm title owns compliance / product data / sustainability / ops for EU sales
3. Find **published** or **Apollo-verified** personal email (never invent)
4. `add-dm.mjs` → gate must return `verified`
5. Promote or wait for timer

## Stripe smoke (unchanged)

Payment Link confirmation redirect:

```text
https://authichain.com/dpp/thanks?session_id={CHECKOUT_SESSION_ID}
```

Promo: `DPP-SMOKE-E2E`.


## HubSpot → verified DMs → Worker

```bash
# Sync CRM contacts through quality gate into pipeline/researched.csv
# ENQUEUE=1 also pushes top N into the Worker send queue (daily cap)
ENQUEUE=1 MAX_ENQUEUE=10 CRON_SECRET=… \
  node scripts/dpp-outreach/sync-hubspot-dms.mjs
```

Secrets live in `~/.config/authichain/integrations.env` and Worker:
`HUBSPOT_SERVICE_KEY`, `RESEND_API_KEY`, `HUBSPOT_PORTAL_ID`, `HUBSPOT_OWNER_ID`.
Trusted provenance: `hubspot_crm`.

## authichain@gmail.com (linked via IMAP)

App password stored outside the repo at `~/.config/authichain/gmail-authichain.env` (mode 600).

```bash
node scripts/dpp-outreach/scan-authichain-inbox.mjs
```

Grok MCP Gmail remains on `undone.k@gmail.com`. Use IMAP for the AuthiChain brand inbox; drafts can use `from: authichain@gmail.com` when Send-as is configured in Gmail.
