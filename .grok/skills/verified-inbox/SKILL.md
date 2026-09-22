---
name: verified-inbox
description: >-
  Use when sending AuthiChain outreach, naming a recipient inbox,
  guessing info@ or press@ aliases, or unfreezing outreach-trigger
  or b2b-outreach.
---

# Verified inbox

Call `classifySend` in `scripts/revenue-operator.ts` before any Gmail send. Provenance is `assessRecipient` in `server/outreach/send-guard.ts`. Apollo status is `mapApolloEmailStatus` in `server/apollo-service.ts`. CRM rows are `scripts/revenue-crm.ts`.

Allowed only when all are true:

- the user named one inbox in this turn
- send-guard status is `allow` (`published_contact`, `apollo_verified`, inbound, or confirmed reply)
- it is not a founder address in `DEFAULT_FOUNDER_EMAILS`
- role inboxes also set `allowRoleInbox`

Otherwise the action is `refuse_send` or `wait_buyer`. Do not dispatch frozen workflows (`mayDispatch`). One prospect, one send. After the gate passes, follow `manual-outreach-playbook` for copy.
