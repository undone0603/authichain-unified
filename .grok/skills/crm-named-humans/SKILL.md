---
name: crm-named-humans
description: >-
  Use when reading AuthiChain HubSpot, Airtable, or Apollo contacts,
  proposing a CRM send list, or treating a HubSpot deal as revenue.
---

# CRM is not a buyer

Stripe livemode is money truth (`classifyRevenue`). HubSpot deals, Airtable prospects, and Apollo people are not.

## Sources

- HubSpot portal 245112265: `classifyHubSpotContact` / `classifyHubSpotDeal` in `scripts/revenue-crm.ts`. Most contacts are guessed aliases. Scan/XP milestone deals (`High-Activity User`, `Power Agent`) are not cash.
- Airtable Operations `app4lw5wNMNmzTNMn`: `classifyAirtableAccount`. Demo rows and fabricated seed (LVMH/Pfizer/Rolex/Gucci/BMW) are do-not-contact. Churned (Mendo / `realthcv@gmail.com`) is do-not-contact. Table IDs live in `libs/integrations/airtable.ts`.
- Apollo: `mapApolloEmailStatus` in `server/apollo-service.ts`. Only `email_status=verified` is `apollo_verified`. Guessed is `pattern_guess`. Locked `email_not_unlocked@` is not a mailbox.

## Send

A CRM row never sends. `classifySend` still requires one inbox named this turn plus trusted provenance from send-guard. Role inboxes need `allowRoleInbox`.
