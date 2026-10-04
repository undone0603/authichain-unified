# Michigan Cannabis Cold Email — No-Calls Edition

Cold outbound template for the 15 Michigan cannabis operators listed in
[`app/outreach/michigan-dispensaries/page.tsx`](../../app/outreach/michigan-dispensaries/page.tsx).
Designed for a **no-sales-calls** funnel: every CTA is a direct Stripe
checkout link or a self-serve walkthrough. Zero booked calls, zero pilot
negotiations, zero human conversations.

## The offer

**AuthiChain BTC Auth — Product cert on Bitcoin, $299 one-time.**

- Dual-chain proof: Polygon (ERC-721) + Bitcoin L1 (Ordinal inscription)
- Permanent public verify page at `authichain.com/verify/[serial]`
- Email delivery in ~30 minutes via OrdinalsBot
- Direct Stripe payment link — no CheckoutModal, no capture worker, no
  sales funnel middleware: https://buy.stripe.com/dRm3cv0EV6BgeSKdLK1Nu1e
- Already live, already fulfilling, already in production
- Cannabis brands buy it as a **brand story asset**, not as compliance
  tooling. "Authenticated on Bitcoin" goes on the bag, the shelf, and
  the website.

## Why this is the right offer for cold outbound

1. **$299 is impulse-buyable by a marketing manager** without procurement
2. **One-time, not subscription** — zero MRR commitment anxiety
3. **Self-serve end-to-end** — no onboarding call, no sales demo, no pilot
4. **The product already exists and already delivers automatically**
5. **The story angle (permanent Bitcoin cert) is native to cannabis culture**
6. **Michigan list already curated** — 15 real operators with named contacts

## Variant A — 90 words (recommended primary)

**Subject:** `$299 Bitcoin cert for {{company}}'s flagship strain`

```
Hi {{first_name}},

I built StrainChain — we inscribe cannabis product auth certs on Bitcoin
L1 (dual-chain: Polygon + BTC). Every bag gets a scannable code that
resolves to a permanent authichain.com/verify page. Uncopyable. Goes on
the bag, the dispensary shelf, and your website as a brand story asset.

$299 one-time, direct checkout, email delivery in ~30 min:
https://buy.stripe.com/dRm3cv0EV6BgeSKdLK1Nu1e

No call, no demo, no pilot. Click, pay, receive.

Walkthrough first: https://authichain.com/strainchain/demos/cultivator

— {{sender_name}}
StrainChain · strainchain.io
{{physical_address}}
Unsubscribe: {{unsubscribe_link}}
```

## Variant B — 40 words (ultra-compact A/B test)

**Subject:** `Bitcoin cert for your flagship strain — $299, no call`

```
{{first_name}},

We inscribe cannabis auth certs on Bitcoin L1. Permanent, uncopyable,
goes on every bag. $299 one-time. Email delivery in 30 min. No call,
no pilot.

Checkout: https://buy.stripe.com/dRm3cv0EV6BgeSKdLK1Nu1e
Walkthrough: https://authichain.com/strainchain/demos/cultivator

— {{sender_name}}
StrainChain · strainchain.io
{{physical_address}}
Unsubscribe: {{unsubscribe_link}}
```

## Personalization tokens

| Token                  | Source                                         | Example                                             |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `{{first_name}}`       | Derive from `contact` title in the target list | "there" if unknown                                  |
| `{{company}}`          | `company` field                                | "Lume Cannabis Co."                                 |
| `{{sender_name}}`      | You                                            | "Z"                                                 |
| `{{physical_address}}` | Required by CAN-SPAM                           | Your physical mailing address                       |
| `{{unsubscribe_link}}` | One-click unsubscribe URL                      | `https://authichain.com/unsubscribe?id={{lead_id}}` |

## Do NOT include

- "Book a call"
- "Schedule a demo"
- "Let's hop on a quick chat"
- "Reply to this email if interested"
- "I'd love to learn more about your process"
- Any calendar links (Cal.com, Calendly, etc.)
- Any "custom quote" or "contact for pricing" language
- Any pilot / trial / free onboarding framing

Every one of those sends the reader into a sales-call funnel. The only
two allowed destinations are (a) the direct Stripe checkout URL or (b)
the self-serve walkthrough page.

## Sending cadence

Send in tier order, not all at once:

1. **Day 0** — `hot` tier (Lume, Gage, Cookies Michigan, JARS) — 4 sends
2. **Day 2** — `warm` tier (Herbology, Green Peak, Skymint, Pleasantrees,
   Verilife, Common Citizen, Canna Provisions) — 7 sends
3. **Day 5** — `cold` tier (High Life Farms, Puff, MedMen, TreeHouse) —
   4 sends

Total: 15 initial sends over 5 days. Do not follow up with a second
touch until you see open / click data. Do not automate a follow-up
sequence yet — the goal of this first wave is to test whether the
**offer** converts, not whether the drip works.

## Success criteria (day-7 checkpoint)

- ✅ Ship: **1+ paid $299 BTC Auth from the Michigan list** = first-dollar success
- ⚠️ Investigate: 15 sends, 0 opens → email deliverability is broken
- ⚠️ Investigate: 15 sends, opens but 0 clicks → subject/offer is wrong
- ⚠️ Investigate: clicks but 0 purchases → pricing page / Stripe checkout friction
- 🔁 Iterate: after 7 days, rewrite the email based on what the data showed

## Related files

- [`scripts/seed-michigan-outreach.ts`](../../scripts/seed-michigan-outreach.ts) — seed data + Supabase insert
- [`ACTIVATION.md`](./ACTIVATION.md) — step-by-step activation guide
- [`app/outreach/michigan-dispensaries/page.tsx`](../../app/outreach/michigan-dispensaries/page.tsx) — source list
- [`make-scenarios/outreach-queue-daily-sender.json`](../../make-scenarios/outreach-queue-daily-sender.json) — Make.com scheduler
