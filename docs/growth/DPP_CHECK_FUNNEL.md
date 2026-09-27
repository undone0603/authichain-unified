# /dpp-check funnel

How to count the free EU DPP readiness check and the $299 audit it leads to.
Nothing here costs money: the counts come from Workers Logs (on for
`authichain-com`) and from Stripe metadata that checkout already writes.

## The three steps

| Step                   | Where it is counted            | Event or filter                                                                            |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| 1. Check completed     | Workers Logs, `authichain-com` | `evt = "dpp_check_complete"`                                                               |
| 2. $299 button clicked | Workers Logs, `authichain-com` | `evt = "dpp_checkout_click"` (`from_dpp_check = true` for clicks from the checker)         |
| 3. Paid                | Stripe Checkout Sessions       | `metadata.plan = dpp_readiness` and `metadata.utm_campaign = dpp-check`, status `complete` |

A blank form view is not a completion. A completion is a GET to `/dpp-check`
with a valid `category`, which is what the form submits.

## What each event carries

- `dpp_check_complete`: `category`, `sells_in_eu`, `score`, `band`, `in_scope`,
  and any `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` on the URL.
- `dpp_checkout_click`: `from_dpp_check` and the UTM fields from the form.

No email address, IP address or free text is logged. The outreach links use
`utm_campaign` values such as `battery-outreach`, so completions from a sent
email can be told apart from search traffic.

## Reading the numbers

Cloudflare dashboard → Workers & Pages → `authichain-com` → Logs. Filter on
the message containing `dpp_check_complete` or `dpp_checkout_click` and set the
time range. For paid conversions, filter Checkout Sessions in Stripe on the
metadata above.

Workers Logs keeps a limited window (days, not months, on the free plan), so
record weekly totals somewhere durable if you need a trend.
