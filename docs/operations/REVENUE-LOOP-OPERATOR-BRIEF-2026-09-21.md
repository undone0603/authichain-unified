# Revenue-loop operator brief — 2026-09-21

**Status:** rails live, first external recurring cash still missing.  
**Do not mark the parent goal complete.** This brief is the handoff so the next cycle can run without a new prompt.

## What is live (verified this cycle)

| Rail | State | Evidence |
| --- | --- | --- |
| Stripe live acct `acct_1SXIyEGqTruSqV8T` | Charges humans. One succeeded charge: **$10** founder self-test `ch_3UHcQfGqTruSqV8T1j4hdD7l` / `pi_3UHcQfGqTruSqV8T18dYFwd3`. Pending balance **$9.31**. **$0 available. Zero payouts ever.** | Stripe MCP, livemode, rechecked 21:11 UTC |
| Passport $49 | Payment Link live | `https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y` · `plink_1UI6mgGqTruSqV8TQPQgeLpM` |
| DPP $299 | Payment Link live; `GET /api/checkout/dpp?email=` → 303 Stripe Checkout | `https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c` |
| Farm Plan $149/mo | Recurring SKU has a durable Payment Link (HTTP 200) | `https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z` · `plink_1UIER1GqTruSqV8TwSSHurov` · price `price_1UHjJWGqTruSqV8TePctYzO5` |
| Email-gated Farm checkout | `GET /api/checkout/plan/strainchain_farm?email=` → **303** live session | Latest probe `cs_live_a15JloQImPpslUXJJWp6q5Eo10UZLEdmt5Lob5pS1Comdieoluy3xVLVdg` (unpaid). HEAD without body stays 204 |
| x402 agent pay | **ready / trustless** $0.05 Base USDC | `GET https://authichain.com/api/x402/health` 200 · `payTo` `0x5db511706FB6317cd23A7655F67450c5AC6e6AA2` · facilitator reachable |
| Subscriptions | **None** | `GET /v1/subscriptions` empty (21:11 UTC) |
| Founder payout | **Bank connected; no payout object yet.** `payouts_enabled=true`, daily / 2-day delay | `ba_1SgDmMGqTruSqV8T9cZoCH3V` THE BANCORP BANK `****2770` verified. `GET /v1/payouts` empty |

Do not mix rails. Human SKUs = `src/lib/plans.ts`. Agent pay = x402 Base USDC to the tokenomics EOA. `$QRON` is not settlement. See `docs/strategy/WEB3_IDENTITY.md`.

## What is not a customer

- Stripe customers named BioShield, Solstice Botanicals, Highland Heritage Distillers, Cascade Defense, Verdant Apex, Nexura Biologics, Aura Horology, MTA Logistics: prior-agent **demo rows**, no paid invoices. Do not mail or invoice them.
- Airtable Accounts that were already in the base (LVMH, Pfizer, Rolex, Gucci, BMW) are **fabricated CRM seed**. Do not treat as pipeline.
- $10 charge and the $0 DPP invoice `in_1UDPUPGqTruSqV8TBF3FdccK` (100% discounted) are founder/self-test.
- Apollo people search / match is **not on the connected Free plan**. Do not burn cycles retrying those endpoints.

## Pipeline (real, this cycle)

Airtable base [Authichain Operations](https://airtable.com/app4lw5wNMNmzTNMn):

| Account | Record | Contact | Status | Next |
| --- | --- | --- | --- | --- |
| Iron Fish Distillery | [recugnCZNhD5KYaBZ](https://airtable.com/app4lw5wNMNmzTNMn/tbldnt00sBS19wxni/recugnCZNhD5KYaBZ) | David Wallace / Heidi Bolger · `sales@ironfishdistillery.com` ([rec1if9ffQVkIyi06](https://airtable.com/app4lw5wNMNmzTNMn/tblzqajBTmfn2iHv9/rec1if9ffQVkIyi06)) | Prospect | **Wait for reply.** Inbox recheck 21:11 UTC: sent only, no inbound. Do not re-mail this week. |
| Mendo Love Farms / RealTHCV | [recKexKf1E03SwzHF](https://airtable.com/app4lw5wNMNmzTNMn/tbldnt00sBS19wxni/recKexKf1E03SwzHF) | Mike · `realthcv@gmail.com` | **Churned** | Reply 2026-09-21 19:10 UTC: “Not interested”. **Do not follow up.** |
| SCHOTT Pharma | [recU5tNFDgtzQoE6w](https://airtable.com/app4lw5wNMNmzTNMn/tbldnt00sBS19wxni/recU5tNFDgtzQoE6w) | Joana Kornblum | Prospect | Already mailed 19:54 UTC. Recheck: no inbound. Wait. |
| JARS Cannabis | [rec4IxXyfOD40XlXT](https://airtable.com/app4lw5wNMNmzTNMn/tbldnt00sBS19wxni/rec4IxXyfOD40XlXT) | Ally Galanty | Prospect | Mailed 18:19 UTC. Recheck: no inbound. Wait. |
| C3 Industries | [recxTxxZNldyi3271](https://airtable.com/app4lw5wNMNmzTNMn/tbldnt00sBS19wxni/recxTxxZNldyi3271) | Krista Freel | Prospect | Mailed 18:08 UTC. Recheck: no inbound. Wait. |
| Existo Solutions | [recqPCDk6axUMHorS](https://airtable.com/app4lw5wNMNmzTNMn/tbldnt00sBS19wxni/recqPCDk6axUMHorS) | Published intake · `contact@existosolutions.com` ([rec6nzaYWfKUFS36v](https://airtable.com/app4lw5wNMNmzTNMn/tblzqajBTmfn2iHv9/rec6nzaYWfKUFS36v)) | Prospect | **Queued, not mailed.** Next new send after a business day of silence. |

Also logged in [Marketing & Demo Intake](https://airtable.com/appERlrcb1RcoPdA7/tblVJgLp2K2Rif08B): Iron Fish `recj7KWnLaa0A11Wb`, Mendo `rec1hJrLxyhJCa35O`.

Events: outreach sent `recOVJdJINZMvfhW6`, Mendo no `recku1JTIcTryKVWQ`, Farm Payment Link `recqEs7JRBOgWtXOt`, Existo queued `recwLG2TLreduZERd`, inbox/payout recheck `recha0hGKpSg1mg3p`.

### This cycle’s send (manual playbook)

- **To:** `sales@ironfishdistillery.com` (published on their Come See Us page as Sales Inquiries — not a pattern guess)
- **From:** `undone.k@gmail.com` (human-read reply-to)
- **Subject:** Gift first: farm-origin record for the Betsie soil-to-spirit story, then one $299 DPP
- **Gmail:** message/thread `1a0c5ccaf763bce5`
- **Gift:** live `/onboard?utm_content=iron-fish`, `/made-in-america`, `/m/bat-2026-001`. No invented CoA.
- **Ask:** `dpp_readiness` $299. Checkout `https://authichain.com/api/checkout/dpp?email=sales@ironfishdistillery.com`

Same-day prior sends (do not duplicate): PufCreativ Morgan, JARS Ally, C3 Krista, SCHOTT Joana, FASTSIGNS Mark Jameson, Trulieve Kalee, Curaleaf Wendy (**blocked**), plus multiple Mike follow-ups that produced the no.

## How the next cycle runs (no new prompt)

1. **Inbox first.** Gmail search `from:(sales@ironfishdistillery.com OR joana.kornblum@schott.com OR ally.galanty@jarscannabis.com OR kfreel@c3industries.com OR morgan@pufcreativ.com) newer_than:7d`. One genuine reply is the unit of success. If Iron Fish replies yes, send only the $299 link already in the thread. If they say no, mark Churned and stop.
2. **Do not spray.** Manual playbook: one prospect, one send, only with published-or-Apollo-verified mail and real data. Today already burned the daily uniqueness budget. The next *new* send waits until those threads have had a business day, or a new inbound appears.
3. **If a reply is a buy:** use the live Payment Link or `GET /api/checkout/…?email=` for that SKU. Confirm the Stripe charge/subscription id in livemode. Then check `GET /v1/payouts` — founder income is not real until a payout leaves Stripe.
4. **If the inbox is silent:** pick **one** unpublished prospect with (a) a company-published named or sales inbox and (b) public facts you can gift from (press, CoA, origin claim). Build the gift first. Soft-ask a catalogue SKU from `src/lib/plans.ts`. Log Accounts + Contacts + Events Log before sending.
5. **x402 path:** rail is already 402. Recurring agent cash needs a funded payer hitting `POST /api/x402` / `POST /api/v1/agent-verify`. Do not invent a second `payTo`. Do not add `$QRON` to `accepts[]`.
6. **Never re-enable** `outreach-trigger.yml` / `dpp-outreach-trigger.yml`. Bounce history and zero replies are why the playbook exists.
7. **Apollo** on this connection is Free — people search/match 403. Use published company pages + Crustdata `company_identify` (free) then a cheap `person_search` if the identify row actually contains a `crustdata_company_id`.
8. **Code follow-up:** `strainchain_farm.stripe_payment_link` is the live URL above. Merge the branch that writes it into `src/lib/plans.ts` so email/ops `planPaymentLink("strainchain_farm")` stops returning undefined. Pricing pages stay on attributed `/api/checkout/plan/strainchain_farm` (email gate).

## Founder-income path

```
Buyer card/USDC
  → Stripe (Passport $49 / DPP $299 / Farm $149/mo / QRON packs)
     or x402 Base USDC $0.05 → tokenomics EOA 0x5db5…6AA2
  → Stripe available balance (2-day rolling) → daily payout
     → ba_1SgDmMGqTruSqV8T9cZoCH3V THE BANCORP BANK ****2770
     → SAM sole-prop (ZACHARY KIETZMAN). payouts_enabled=true.
```

Blocker on the Stripe leg is **no external paid customer**, not a missing bank. The $10 founder self-test is still pending ($9.31). No `po_` exists yet because available is $0. Do not treat pending as founder income.

## Queued next prospects (not mailed this sitting)

Use only if the waiting threads stay silent and you still have a published contact + real public facts:

- **First:** Existo Solutions `contact@existosolutions.com` — already in CRM (`recqPCDk6axUMHorS`). Gift the live Mendo dossier shape + Farm $149/mo / Passport $49. Channel partner, not an MSO blast.
- Coppercraft, Michigrain, Eastern Market, Off the Chain, Detroit City, Valentine, Long Road — onboard URLs exist in `content/strainchain/michigan-distilleries/outreach-links.md`. **Verify a published inbox first.** `info@` pattern-guesses are what the deliverability runbook forbids.
- EU battery / LMT exporters for DPP $299 (Feb 2027 battery deadline). Prefer a named press/sustainability contact printed on their site. Umicore `/en/newsroom/press-contacts/` 404'd on 2026-09-21 — do not guess an inbox.

## Recommended next concrete action

Tomorrow morning: read Gmail for `1a0c5ccaf763bce5` and the SCHOTT/JARS/C3 threads. If any is a yes, complete checkout and watch for `ch_` / `sub_` then a `po_` to Bancorp `****2770`. If all silent, run **one** new playbook cycle on Existo (`contact@existosolutions.com`) — gift first, then Farm $149/mo. Do not mail Mike. Do not mail the fake Stripe/Airtable names (LVMH, Pfizer, Rolex, Gucci, BMW). Merge `cursor/farm-plan-payment-link-0d59` so `planPaymentLink("strainchain_farm")` stops returning undefined on main.
