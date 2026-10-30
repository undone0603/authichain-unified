# DPP follow-up: one email, only to people who asked

`/dpp-check` is free and logs no address. Someone who finishes it and does not
open checkout used to be unreachable. The result page now has an optional,
unticked "email me this result" box. For the people who tick it, one fixed
email goes out, once.

This is deliberately not the old closer. `server/agents/closer.ts` and
`agentz/core/closer.py` write free-text pilot proposals at $2,500 to $25,000
that are not in `src/lib/plans.ts`; neither is connected to buyers. This
follow-up has no model call and no free text.

## What is sent

`buildDppFollowup()` in `src/lib/dpp-followup.ts`. A fixed template with:

- the category, score and band the visitor already saw;
- the dated obligation only when `category.status === "law"`;
- a link that reopens their result;
- the plan named exactly as `plans.ts` names it (EU DPP Workspace, one-time,
  50 workspace generations) with the checkout link;
- "It is not an audit, not a certification and not legal advice, and it does
  not register a product in EUDAMED.";
- "This is the only follow-up we will send."

A unit test runs every category and band through the outbound claims filter,
and fails if the body says "audit" anywhere but that disclaimer.

## Who is eligible

`selectDueFollowups()`: a `lead_captures` row with `source = dpp-check` and
`product_interest = dpp_check_followup`, a parseable result in `message`, between
4 hours and 14 days old, one per address. Then the script also drops:

| Skipped                                         | Why                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Started checkout or paid (`funnel_events`)      | A buyer is not pitched what they bought; an abandoned checkout has its own recovery email |
| Suppressed, opted out, or emailed by any script | `priorContact()` in `scripts/lib/send-history.ts`                                         |
| Anything `guardedSend` refuses                  | Provenance, MX, postal address, recordable opt-out, claims filter                         |

If the checkout history or send history cannot be read, nobody is emailed.

## How to run it

Manual only; there is no schedule.

```bash
gh workflow run dpp-followup.yml                  # dry run
gh workflow run dpp-followup.yml -f dry_run=false # live, if OWNER_LIVE_SEND=true
```

A dry run runs every gate and stops before the network. In the run summary,
`would_send` means every gate passed; `skipped` names the reason. Live needs
both the unchecked box and the repo variable `OWNER_LIVE_SEND=true`, and sends
at most `max_sends` (default 3). Each sent email is recorded in
`guardrail_suppression_list` (so no script mails the address again) and in
`automation_logs` with `workflow_name = dpp_followup`.

Every address in logs and the run summary is masked (`jo***@example.com`).

## Things to know

- **Deploy.** The opt-in form lives in `authichain-com`, which is not
  auto-deployed. Until it is deployed there is nothing to follow up.
- **Consent.** `lead_captures` has no consent column. The row's
  `product_interest = dpp_check_followup` is the consent record, and only the
  form with the ticked box can write it.
- **Role inboxes** (`info@`, `sales@`) are refused by `guardedSend` for this
  source. They show up as `skipped: blocked: ...` in the report.
- **Price.** The email states the workspace price from `plans.ts`. If prices are
  held, the email changes with `plans.ts`; nothing is hard-coded here.
