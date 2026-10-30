# /dpp-check funnel

How to count the free EU DPP readiness check and the $299 EU DPP Workspace it
leads to (not an audit: see `src/lib/plans.ts`).
Nothing here costs money: the counts come from Workers Logs (on for
`authichain-com`) and from Stripe metadata that checkout already writes.

## The three steps

| Step                   | Where it is counted            | Event or filter                                                                            |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| 1. Check completed     | Workers Logs, `authichain-com` | `evt = "dpp_check_complete"`                                                               |
| 2. $299 button clicked | Workers Logs, `authichain-com` | `evt = "dpp_checkout_click"` (`from_dpp_check = true` for clicks from the checker)         |
| 2b. Result emailed     | Supabase `lead_captures`       | `source = dpp-check`, `product_interest = dpp_check_followup` (see below)                  |
| 3. Paid                | Stripe Checkout Sessions       | `metadata.plan = dpp_readiness` and `metadata.utm_campaign = dpp-check`, status `complete` |

A blank form view is not a completion. A completion is a GET to `/dpp-check`
with a valid `category`, which is what the form submits.

## What each event carries

- `dpp_check_complete`: `category`, `sells_in_eu`, `score`, `band`, `in_scope`,
  and any `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` on the URL.
- `dpp_checkout_click`: `from_dpp_check` and the UTM fields from the form.

No email address, IP address or free text is logged to Workers Logs. The one
place an address is kept is the optional opt-in below. The outreach links use
`utm_campaign` values such as `battery-outreach`, so completions from a sent
email can be told apart from search traffic.

## Reading the numbers

Cloudflare dashboard → Workers & Pages → `authichain-com` → Logs. Filter on
the message containing `dpp_check_complete` or `dpp_checkout_click` and set the
time range. For paid conversions, filter Checkout Sessions in Stripe on the
metadata above.

Workers Logs keeps a limited window (days, not months, on the free plan), so
record weekly totals somewhere durable if you need a trend.

## The optional email opt-in

A visitor whose result is in scope sees an unticked box: "Email me this result,
plus one follow-up about the $299 workspace." Ticking it and submitting writes
one row to `lead_captures` through `POST /api/leads/capture`. The row is the
consent record: it exists only if the box was ticked, and its `message` holds
nothing the visitor typed, only `dpp-check:<category>:<score>:<band>`.

Count them in Supabase:

```sql
select count(*) from lead_captures
where source = 'dpp-check' and product_interest = 'dpp_check_followup';
```

What happens next, and how to send it, is in [DPP_FOLLOWUP.md](./DPP_FOLLOWUP.md).
