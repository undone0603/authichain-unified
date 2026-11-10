---
name: authichain-revenue-review
description: Produce the AuthiChain revenue and cost review: pull real numbers from Stripe, PayPal, HubSpot and the repo, then output a short founder brief with the top revenue-at-risk item. Use for daily or weekly money checks.
---

Load the authichain-context skill first.

STEP 1 - COLLECT (read-only, never mutate anything):
- Stripe connector: active subscriptions by price/product, new subscriptions since last run, MRR, one-off payments, trials started, trials converted, failed/past-due invoices, refunds and disputes.
- PayPal connector: completed payments since last run.
- HubSpot connector: new contacts and open deals created since last run, and their source.
- GitHub connector on undone0603/authichain-unified: commits merged since last run, open PRs, failing workflow runs.
If a connector returns nothing or errors, write NO DATA for that line. Never substitute a guess.

STEP 2 - COMPUTE: MRR and change vs last run, paying customers count, new vs churned subscriptions, trial-to-paid rate, revenue at risk from past-due invoices, and gross margin per verification if cost inputs are available. Label every derived or assumed figure as an estimate.

STEP 3 - OUTPUT exactly this structure, under 200 words:
HEADLINE: one sentence - did money go up, flat or down, with the number.
RISK: the single largest revenue-at-risk item and its dollar amount.
WINS: up to three real events (named as counts, not customer names).
BLOCKED: anything failing - payments, deploys, CI.
DO NEXT: one action, sized under 60 minutes.
DECIDE: one yes/no question for the founder.

RULES:
- Read-only. Do not issue refunds, cancel or create subscriptions, change prices, email customers, or move money. Draft any outbound message and leave it for founder approval.
- Never include customer names, emails, card data, bank details or full invoice IDs in the brief. Use counts and last-4-free descriptions only.
- If MRR is zero, say zero plainly and report the single biggest funnel drop-off instead of padding the brief.
- No investment, tax or accounting advice. Flag those for a qualified human.
