# AgentZ Bridge: a Chrome extension for AgentZ

Status: design approved by the owner on 2026-11-19. Not built yet.

## Why
AgentZ's own browser (`agentz/core/public_navigation.py`) is read-only. It also refuses to run unless `AGENTZ_BROWSER_NETWORK_ISOLATED=true` on a separately isolated host, and none exists. Contact-form outreach (for example Lyten) needs a browser that can fill in and submit forms. Claude in Chrome proved the pattern on 2026-11-19.

## Shape
- **Extension:** Chrome Manifest V3 in `apps/agentz-bridge-extension/`, loaded unpacked. No Web Store, free.
- **Pairing:** it pairs with local AgentZ (`http://127.0.0.1:8000`) using a one-time token shown by AgentZ. It talks to no other backend.
- **New AgentZ endpoints:** `/agentz/bridge/tasks` (queue) and `/agentz/bridge/results`. They change guardrail code, which the owner approved for this feature.

## Control model (owner decision: pre-approved batches)
- **Read tasks** (open a public HTTPS page and return a snapshot) run without approval.
- **Form tasks** run only inside a **batch** the owner approved once. A batch is a list of exact domains, exact form URLs and the exact text per field. Inside it, the extension fills and submits without further clicks.
- Anything outside the approved batch (another domain, another field value, a new required field) pauses that task and asks the owner.

## Hard rules, enforced in the extension and not only in AgentZ
- Public HTTPS only. Domain must be on the task's or batch's allowlist. No private IPs and no localhost targets.
- **Never** solve or bypass a CAPTCHA or bot check: stop and hand over to the owner.
- Never fill hidden honeypot fields. Never enter passwords, payment details or government IDs.
- A field value missing from the batch, such as Lyten's surprise required "Job Title", pauses the task rather than being invented.
- Each submit returns evidence to AgentZ: URL, UTC timestamp, the submitted values, and a SHA-256 of the confirmation text or screenshot. AgentZ then logs a HubSpot contact (`ATTEMPTED_TO_CONTACT`, dated campaign tag).

## First batch candidate
Form-only battery-passport leads from Airtable `US Battery Leads`, with per-company text that still needs owner approval: 24M, Factorial, Sila, Ascend Elements, Clarios, ION Storage Systems and others.

Lyten is already done by hand (2026-11-19, HubSpot 601852360419). Skip Microvast and EnerSys.

## Tests
- Unit tests for the allowlist, CAPTCHA detection, honeypot skipping and batch matching.
- An AgentZ endpoint test: tasks are refused without a paired token, and form tasks are refused outside an approved batch.
