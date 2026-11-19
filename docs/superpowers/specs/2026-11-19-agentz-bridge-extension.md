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

## Auto-approve with high confidence (owner decision, 2026-11-19)
The owner asked for submissions to auto-approve when confidence is high. "High confidence" is not a model score. A form task auto-approves only if **every** check below passes. Otherwise it falls back to the owner's batch approval.

1. **Known target.** The company is on an approved lead list (for example Airtable `US Battery Leads`), the form URL is on the company's own domain, and the company has no prior contact, opt-out or bounce in Gmail or HubSpot.
2. **Approved template.** The message is an owner-approved template where only listed variables change (company name, product line, one fact). Each fact must come from a cited public source on the company's own site or an official register. No other free text.
3. **Owner-approved fields only.** Every required field's value comes from the owner's approved sender profile (name, company, email, the phone the owner approved, job title "Founder", country). An unknown required field pauses the task.
4. **Rate and scope limits.** At most 5 auto-submits per day, 1 per company ever, campaign "EU battery passport" only. A daily digest of every auto-submit goes to the owner (ntfy plus HubSpot log).
5. **Clean page.** No CAPTCHA or bot check, no login, no payment, and no consent checkbox beyond the site's standard privacy notice. A pre-ticked marketing opt-in is unticked.

Kill switch: AgentZ env `AGENTZ_BRIDGE_AUTO_APPROVE=false` (the default until the owner sets it `true`) turns this off instantly. Any reply of "no thanks" or "stop" from a company blocks the whole domain.

### Activation gate (from `docs/outreach-deliverability-runbook.md` and `.claude/skills/manual-outreach-playbook`)
The repo's automated outreach was disabled after zero replies and a 16% bounce rate. Auto-approve ships **off** and may be turned on only when all of these hold, recorded in HubSpot:
- at least one real reply to a hand-sent message in this campaign
- bounce rate under 3% on the verified list
- a monitored reply-to address (the daily reply-watch routine `trig_0196n8Mo65si64DLmrqvJNxA` covers this)

Until then the extension runs in batch-approval mode. AgentZ refuses `AGENTZ_BRIDGE_AUTO_APPROVE=true` with a clear error while any criterion is unmet.
