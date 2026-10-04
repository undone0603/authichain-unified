# StrainChain Marketing & Demo Intake

## Purpose

This document is the internal handbook for the **StrainChain (cannabis
vertical)** intake pipeline. Every inbound request for a demo, pilot,
partnership, press briefing, regulator meeting, or custom strain QRON is
collected through a single Airtable form and triaged from there.

StrainChain shares the same top-level AuthiChain + QRON intake form — with
an additional cannabis-specific triage overlay so the marketing lead can
route by persona, state, and licence status.

## Intake form

All requests must be submitted through the Airtable intake form:

**Form URL:** https://airtable.com/appERlrcb1RcoPdA7/tblVJgLp2K2Rif08B/viwPH8zIn44lFjuc1

Submitters should tag their request with `vertical: cannabis` (or mention
StrainChain in the free-text field) so it lands in the StrainChain triage
queue.

Share this link externally in:

- Outbound dispensary / MSO sales emails
- Trade-show booths (MJBizCon, Hall of Flowers, CannaCon)
- LinkedIn / Twitter bios for the StrainChain team
- The public `app/strainchain` landing page
- Cannabis-industry press kits and investor decks

## Cannabis-specific triage rules

Every cannabis request must be routed by **persona + state + licence
status** before being assigned an owner. Use this matrix:

| Persona    | Route to                          | Priority rule                                   |
| ---------- | --------------------------------- | ----------------------------------------------- |
| Cultivator | Grower onboarding lead            | Prioritise licensed craft flower producers      |
| Lab        | Lab integrations lead             | Prioritise ISO-accredited + state-licensed labs |
| Dispensary | Retail partnerships lead          | Prioritise MI, CA, CO, IL, NV first             |
| MSO        | Enterprise / MSO account lead     | Always highest priority                         |
| Consumer   | Marketing — no personal follow-up | Route to brand / QRON gallery CTA               |
| Regulator  | Compliance + policy lead          | Escalate to CEO for state-level briefings       |

## Instructions for internal use

1. **Triage daily.** The marketing lead reviews new cannabis-tagged
   submissions every morning and assigns an owner within Airtable.
2. **Confirm licence status** before any dispensary, cultivator, lab, or
   MSO follow-up. We only onboard licensed operators — verify the state
   licence number before a demo call.
3. **Tag by persona** using the same labels found in
   [`demo-mapping.md`](./demo-mapping.md) (cultivator, lab, dispensary,
   consumer, regulator). This keeps the demo requests aligned with the
   persona flows that live in `app/strainchain/demos/*`.
4. **Link to the matching persona flow.** When an inbound request lands
   for a persona that already has a demo, reply with the direct demo URL
   (for example `https://strainchain.io/demos/dispensary`).
5. **Escalate custom strain QRONs.** If the request requires a
   brand-specific QRON or storymode, create a follow-up task for
   engineering and reference the entry that will be added to
   `outputs/strainchain-demo-manifest.json` (or
   `outputs/storymode-demo-manifest.json` for storymode products).
6. **Never share operator data externally.** Licence numbers, batch IDs,
   and submitter details stay inside the Airtable base. Do not forward or
   export without written approval from the StrainChain lead.
7. **Close the loop.** Mark the Airtable record as “Delivered” only after
   the prospect has received either a live demo, a recorded walkthrough, or
   the requested marketing asset.

## SLA

| Request type                | First response  | Delivery target |
| --------------------------- | --------------- | --------------- |
| MSO enterprise pilot        | 1 business day  | 3 business days |
| Dispensary partnership      | 1 business day  | 5 business days |
| Cultivator onboarding       | 1 business day  | 5 business days |
| Lab integration enquiry     | 2 business days | 5 business days |
| Regulator / policy briefing | 1 business day  | 2 business days |
| Press / media               | 1 business day  | 2 business days |
| Consumer / general cannabis | 2 business days | 5 business days |
