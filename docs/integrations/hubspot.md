# HubSpot — Authichain portal

The Grok HubSpot connector (connected 2026-09-17) is bound to this repo.

| | |
|---|---|
| Portal | **Authichain** |
| Portal ID | `245112265` |
| UI | [app-na2.hubspot.com](https://app-na2.hubspot.com/contacts/245112265) |
| Owner | Zac (`ownerId` `87978084`) |
| Pipeline | Sales Pipeline (`default`) |
| Currency / TZ | USD · US/Eastern |

Canonical machine config: [`config/hubspot-portal.json`](../../config/hubspot-portal.json). TypeScript helpers: [`server/hubspot-portal.ts`](../../server/hubspot-portal.ts).

## Two auth paths (do not mix)

1. **Grok HubSpot connector** — OAuth grant on the Grok side. Used by the agent in chat to search, update, and onboard CRM records. It is **not** a deploy secret and cannot be injected into Cloudflare Workers or GitHub Actions.
2. **`HUBSPOT_SERVICE_KEY`** — HubSpot private-app token already wired through [`server/hubspot-service.ts`](../../server/hubspot-service.ts) and AgentZ (`agentz/core/hubspot.py`). Required for CI, lead sync, and drip unstick.

Set `HUBSPOT_PORTAL_ID=245112265` if you ever point a sandbox token at a different portal. Default is this production portal.

## What lives here

Live snapshot from the connector (2026-09-17):

| Object | Count | Notes |
|---|---:|---|
| Contacts | 179 | Mix of real pilots (Trulieve, Curaleaf, Onnit) and noisy imports |
| Companies | 133 | Cannabis MSOs, luxury, DoD/DLA, print vendors |
| Deals | 171 | Open pipeline ~$83.3M (exclude closed-lost) |
| Tasks | 268 | Almost all HIGH follow-ups, last touched 2026-08-21 — stale |

Stage mix (default pipeline):

- Appointment Scheduled — 116 deals · $51.6M
- Presentation Scheduled — 37 deals · $31.6M
- Qualified To Buy — 9 deals · $163K (warm StrainChain MSO pilots)
- Closed Won — 1 · $799 (test customer; not a real sale)
- Closed Lost — 8 · $1.0M

Warm StrainChain pilots (Qualified To Buy): Trulieve, Curaleaf, Cresco, Lume, JARS, Cloud Cannabis, Pure Options, Onnit (QRON). APEX Accelerators / DoD SBIR sits at Appointment Scheduled ($175K).

## Code that already talks to this portal

- `server/hubspot-service.ts` — contacts, companies, deals, `syncLeadToHubSpot`, `syncPaymentToHubSpot`
- `scripts/sync-mi-leads-hubspot.ts` — Michigan cannabis CSV → contacts
- `scripts/dpp-outreach/sync-hubspot-dms.mjs` — DPP outreach pull
- `agentz/core/hubspot.py` + `hubspot_healer.py` — AgentZ deal fetch + token rotation
- `agentz/workflows/handlers/hubspot_followups.py`, `hubspot_drip_unstick.py`, `hubspot_backlog_processor.py`

New helpers:

```ts
import { classifyVertical, hubspotRecordUrl, HUBSPOT_PORTAL } from "../server/hubspot-portal";

classifyVertical("Trulieve — StrainChain Dispensary Pilot"); // "strainchain"
hubspotRecordUrl("deal", "320453470925");
```

Health check (needs `HUBSPOT_SERVICE_KEY`):

```bash
npx tsx scripts/hubspot-portal-health.ts
```

## Vertical tags

`classifyVertical(name, description)` maps deal titles onto AuthiChain lines so dashboards and AgentZ can filter without extra HubSpot properties:

| Tag | Trigger |
|---|---|
| `strainchain` | StrainChain, METRC, MI MSOs, dispensaries |
| `luxury` | LVMH, Hermès, Kering, Rolex, Richemont, Breitling |
| `govchain` | DoD, DHS SVIP, CBP, SBIR, ITAR, Navy |
| `medical` | Pfizer DSCSA, FDA, J&J, EUDAMED |
| `qron` | QRON, Product Hunt, Onnit |
| `industrial` | Nike, Apple, Amazon, 3M, CATL |
| `funding` | Casa Verde, SAFE, pitch competitions |

## Hygiene (do not dump into git)

The repo is public. Never commit contact emails, notes, or CRM exports. Portal IDs and public record-URL templates are fine.

Test / garbled contacts (e.g. `test-*@example.com`, random-consonant names) should stay out of outreach sequences. Filter `email CONTAINS example.com` or `firstname = Test` before any drip.

## Next wiring

1. Point AgentZ `hubspot_token` at a private app **on portal 245112265** (same owner as the Grok connector).
2. Run `scripts/hubspot-portal-health.ts` in CI once the secret exists.
3. Use `classifyVertical` when writing deal notes so follow-ups land on the right brand line.
