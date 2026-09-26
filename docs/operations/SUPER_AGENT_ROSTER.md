# Super Agent roster — draft / dry-run

Status: 2026-09-24. Founder asked to set up Super agent Grok bots for business ops.
This is not unsupervised send. AgentZ stays `dry-run` unless `?live=true`.

Cost: $0 extra (SuperGrok quota). Work removed if briefs are used: ~5h/week of inbox + CI + money glance.

## Live Grok automations

| Bot | When | May do | Must not |
|---|---|---|---|
| AuthiChain ship gate | 07:00 ET daily | Grade CI / Workers / PRs. HOLD if unknown. | Merge, deploy, rerun, print secrets |
| AuthiChain revenue watch | 07:30 ET daily | Stripe MRR, charges, webhook proof watch | Change prices, refund, email buyers |
| Daily X radar | 08:30 ET daily | Draft replies + 1 original post | Post as @Undone0603 |
| Task Extractor | 17:00 ET daily | P0–P2 list from Gmail / Notion / GitHub | Invent metrics, spend SaaS |
| First-dollar Stripe watch | Gmail `@stripe.com` | Label SELF-TEST vs FIRST-DOLLAR-CANDIDATE | Refund, send dunning |
| CI red on authichain-unified | GitHub workflow failure on repo `1168058941` | Name the failed job vs known-red Workers Builds | Rerun / merge |

## Paused on purpose

- LinkedIn Lead Finder webhook — outreach generator. Trigger disabled.
- Email Auto-Responder — schedule disabled. Too broad; would draft to burned leads.

## AgentZ (repo)

```bash
python -m agentz.cli list
python -m agentz.cli run launch_governor --mode dry-run
```

`run --all --mode auto` is refused. Architect and `*email*` workflows stay dry-run unless `live=true`.

Do not flip live: `hubspot_drip_unstick`, `linkedin_strainchain_outreach`, `strainchain_email_pitch`, `hot_lead_outreach_blitz`, `authichain_worker_outreach`, `authichain_docusign_blitz`, `qron_stripe` DM distribute.

Money write path is already live and is not a Grok bot:

```
POST https://authichain.com/api/stripe/webhook
checkout.session.completed → provisionPurchase → profiles.generations_limit
```

Starter $29 = 100 gens. DPP $299 = 50 gens.

## HUMAN-ONLY

- Cloudflare Dashboard → Workers `authichain` → Build command = `pnpm exec vite build`
- Merge PR #1234 after Theater tests green
- Name the $29 To: or post the Payment Link on X
- Stripe bank / tax / live price edits
- AgentZ `live=true`
- DNS, OAuth grants, GitHub/Cloudflare permissions

## Kill

- Any bot that sends email or posts without a named To: → pause it
- Facilitator / payTo drift on x402 → pause agent-pay copy
- Charge exists and `generations_limit` is 0/null → webhook miss, not a traffic miss
