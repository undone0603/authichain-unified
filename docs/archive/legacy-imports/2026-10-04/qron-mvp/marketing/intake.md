# AuthiChain Marketing & Demo Intake

## Purpose

This document is the internal handbook for the **AuthiChain Marketing & Demo
Intake** pipeline as it applies to QRON.space. Every inbound request for a
demo, partnership, press briefing, investor update, or custom industry
QRON is collected through a single Airtable form and triaged from there.

Keeping a single intake surface makes the process measurable, ensures nothing
is lost in email, and lets us feed marketing data directly back into the
demos and products that live in this repository.

## Intake form

All requests must be submitted through the Airtable intake form:

**Form URL:** https://airtable.com/appERlrcb1RcoPdA7/tblVJgLp2K2Rif08B/viwPH8zIn44lFjuc1

Share this link externally in:

- Outbound sales emails
- LinkedIn / X / Telegram bios
- Investor decks (QR code on the last slide)
- The public QRON.space “Book a demo” CTA
- Conference and trade-show hand-outs

## Instructions for internal use

1. **Triage daily.** The marketing lead reviews new intake submissions every
   morning and assigns an owner within Airtable.
2. **Tag by industry** using the same labels found in
   [`demo-mapping.md`](./demo-mapping.md) (pharma, cannabis, luxury,
   collectibles, supply chain, etc.). This keeps the demo requests aligned
   with the demos that actually exist under `app/demo/*`.
3. **Link to the matching demo.** When an inbound request lands for an
   industry that already has a demo, reply with the direct demo URL (for
   example `https://qron.space/demo`).
4. **Escalate custom demos.** If the request requires a brand-specific QRON
   or storyline, create a follow-up task for engineering and reference the
   related demo target in `lib/demo-targets.ts`.
5. **Close the loop.** Mark the Airtable record as “Delivered” only after
   the prospect has received either a live demo, a recorded walkthrough, or
   the requested marketing asset.
6. **Never share raw data externally.** The Airtable base is for internal
   use only — do not export or forward submitter details without written
   approval from the marketing lead.

## SLA

| Request type          | First response  | Delivery target |
| --------------------- | --------------- | --------------- |
| Investor briefing     | 1 business day  | 3 business days |
| Custom industry demo  | 1 business day  | 5 business days |
| Partnership enquiry   | 2 business days | 5 business days |
| Press / media         | 1 business day  | 2 business days |
| General marketing ask | 2 business days | 5 business days |
