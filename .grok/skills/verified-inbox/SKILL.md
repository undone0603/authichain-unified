---
name: verified-inbox
description: >-
  Use when sending AuthiChain outreach, naming a recipient inbox,
  guessing info@ or press@ aliases, or unfreezing outreach-trigger
  or b2b-outreach.
---

# Verified inbox

Call `classifySend` in `scripts/revenue-operator.ts` before any Gmail send.

Allowed only when all are true:

- the user named one inbox in this turn
- that inbox is published by the company (or Apollo-verified)
- it is not a pattern guess
- it is not a founder address in `DEFAULT_FOUNDER_EMAILS`

Otherwise the action is `refuse_send` or `wait_buyer`. Do not dispatch frozen workflows (`mayDispatch`). One prospect, one send. After the gate passes, follow `manual-outreach-playbook` for copy.
