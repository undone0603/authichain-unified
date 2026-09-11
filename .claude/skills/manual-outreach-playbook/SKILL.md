---
name: manual-outreach-playbook
description: Run a single, hand-crafted outreach cycle for one qualified prospect -- reconcile their real data (emails, lab reports, CoAs, whatever they've sent), build them something concrete and free from it (a Digital Product Passport, a pitch, a proposal), then send one personalized email referencing specifics only they would recognize. Use when asked to "reach out to", "pitch", "follow up with", or "build a passport/pitch for" a named prospect or lead. Explicitly NOT for bulk, scheduled, or automated outreach -- see "Why manual, not automated" below before ever proposing a cron, workflow, or batch send from this playbook.
---

# Manual Outreach Playbook

A repeatable, per-prospect process for turning a real relationship (an email thread, a lab report, a lead) into a paying customer -- run by hand, one prospect at a time, never as a scheduled job.

## Why manual, not automated

This repo already has a fully-built automated outreach pipeline (`workers/qron-outreach/src/index.ts`'s `DPP_QUEUE`, 53+ AgentZ workflows, an LLM personalizer, Stripe SKUs wired end-to-end). It is **deliberately disabled**. `docs/outreach-deliverability-runbook.md` documents why: zero replies ever, across every automated campaign, at a 16% bounce rate, because contacts were guessed (`compliance@company.com`-style patterns) rather than real, and the sending domain was never authenticated (no SPF/DKIM/DMARC).

The runbook's own conclusion, written after that failure: *"stop automating and go manual... track replies, not sends... when a version starts getting replies, THEN it is worth automating."*

This skill exists to run that manual phase well and leave a record of what worked. **Do not** use it to justify re-enabling `dpp-outreach-trigger.yml`, `outreach-trigger.yml`, or any batch/cron send. If asked to "automate this" or "turn this into a routine," point back to this section and to the runbook's success criteria (SPF/DKIM/DMARC passing, bounce rate under 3%, a monitored reply-to, at least one message proven to get real replies by hand) before agreeing.

## When to use this

- A named person or business has already sent you real data (lab results, product specs, financials, anything concrete) -- not a cold list.
- You know their actual contact, not a guessed or scraped one.
- You want to turn that relationship into revenue: a paid passport, a subscription, a licensing deal, a contract.

If any of those isn't true -- no real data, no verified contact, no existing relationship -- this playbook doesn't apply yet. Get a verified contact first (see `docs/CAPABILITIES.md`'s address-provenance findings: Apollo-verified or published-by-the-company-itself only; never a pattern guess).

## The cycle

### 1. Pull everything they've actually sent

Search email, attachments, any shared files for this specific prospect. Read every attachment fully (PDFs, CoAs, spreadsheets) rather than skimming subject lines -- the details that make outreach land are usually buried in an attachment, not the email body.

### 2. Structure it

Turn the raw material into a clean, structured record (JSON, a table, whatever fits) that:
- Separates **verified** data (from a certificate, a filed document, an authoritative source) from **claimed** data (what the prospect said in prose).
- Flags every discrepancy between the two instead of quietly picking one. Reconciling and surfacing mismatches is itself a trust-building deliverable -- it shows you actually checked their work.
- Notes anything genuinely unclear or missing, to ask about later rather than guess.

### 3. Build them something real, free, first

Before asking for anything, hand them something useful built from their own data: a verified profile page, a passport, a structured report. It should be good enough to stand alone as a gift, not just deck-dressing for the ask. Match design effort to the artifact's actual audience and permanence -- see `artifact-design` skill before publishing anything visual.

Cite sources precisely (a CoA ID, a date, a batch number) so the artifact reads as evidence, not marketing copy.

### 4. Then make the ask

Only after step 3 exists, propose the paid version: a service tier, a subscription, a licensing structure, a contract. Ground pricing in whatever's already defined in `shared/pricing.ts` rather than inventing new numbers. Keep the ask soft on a first pitch -- "no pressure either way" outperforms a hard close on a first-touch email to someone who hasn't bought anything yet.

### 5. Send one email, personalized, from a real reply-to

- Reference specifics only this prospect would recognize (a figure from their own data, an award, a detail from their email).
- Send from an address a human actually reads, never `noreply@`.
- One prospect, one send. Do not batch this step across multiple prospects in one sitting disguised as "still manual" -- if you're sending the same templated email to five people in a row, you've re-invented the automation this playbook exists to avoid.

### 6. Track the reply, not the send

Log what happened: reply / no reply / bounce, and what they said. A single genuine reply from a real prospect is the unit of success here -- not send volume. If something you built or claimed turns out to be wrong once they respond (a lineage assumption, a number), correct the artifact and say so plainly; getting caught quietly hoping they don't notice destroys the trust the whole approach depends on.

### 7. Close the loop in writing

If a verbal or informal confirmation (a call, a LinkedIn reply, a text) affects anything you've published or claimed, get it confirmed in writing over email before treating it as fact anywhere the prospect or a third party (a licensing partner, a buyer) might see it. Casual confirmations are fine for your own working assumptions; they are not enough to publish as verified.

## What "done" looks like for one cycle

- One real reply, or a clear reason there wasn't one (bad contact, wrong offer, bad timing) worth recording for the next attempt.
- Nothing published or sent that overstates what's actually verified.
- A reusable artifact (the passport, the structured data) that keeps compounding if this prospect becomes a customer or if you build the next one.

Only after several of these cycles produce real replies with a consistent message -- per the runbook's own bar -- does it become worth revisiting automation, and even then the fix order is: authenticate the domain, verify contacts at scale, warm up sends gradually, keep human review on. Automating a message that hasn't been proven by hand just automates the silence.
