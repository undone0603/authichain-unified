# SuperGrok bots — business operations roster

Status: 2026-09-24. Draft / dry-run. Not AgentZ live-send.

These Grok Automations watch money, CI, and the public loops.
They do not send email, post on X, merge main, or change Stripe prices.

## Live (Grok Automations)

| Bot | Trigger | May do | Must not |
|---|---|---|---|
| AuthiChain ship gate | Daily 07:00 ET | Grade CI / Workers | Merge, deploy, comment |
| AuthiChain revenue review | Daily 07:30 ET | Read Stripe / PayPal / HubSpot | Refund, price edit, email |
| Daily X radar | Daily 08:30 ET | Draft replies + 1 post | Publish as @Undone0603 |
| SuperGrok Growth Loop Watch | Daily 08:45 ET | HTTP-check money URLs | Invent traffic, email |
| Task Extractor | Daily 17:00 ET | Extract P0–P2 into Notion | Close tasks without proof |
| SuperGrok First Dollar Watch | Gmail from `@stripe.com` | Classify $29/$99/$299/$49 | Count founder charges |
| SuperGrok CI Break | GitHub workflow failure on `authichain-unified` | Name the red check | Rerun, merge |

## Paused

- LinkedIn Lead Finder (webhook outreach generator)
- Email Auto-Responder (too broad; burned-lead risk)

## AgentZ (separate runtime)

- Live health: `https://agentz.authichain.com/health`, `https://claw.authichain.com/health`
- Orchestration workflow: dry-run only
- CLI `run --all --mode auto`: refused
- Do not thaw `content-publish`, `outreach-trigger`, `ghost-traffic`, `b2b-outreach`

Grok Bot `be68e544-29a7-4bc6-a3f0-dcedc1e94d83` is a Cursor teammate. It does not post.

## Loops the Growth bot may run

### Loop A — Verify miss (on-site only)

- Trigger: `/verify` unknown ID
- Mechanism: "No seal on file. Seal this product — no call." → `/onboard`
- CVR estimate: 5–12% of misses to email; 0.5–2% of those to paid
- Events: `verify_miss`, `onboard_submit`, `checkout_session_completed`
- Kill: welcome email silent 7 days after a paid session

### Loop B — Generate → $29

- Trigger: qron.space/generate without a session
- Mechanism: queue a pilot seal + Starter Payment Link
- CVR estimate: 2–6% of target-URL submits
- Events: `generate_submit_anon`, `cta_click_starter_29`, `checkout_session_completed`
- Kill: 200 generate submits / 30 days / 0 paid → keep 5-gen cap

### Loop C — Battery deadline

- Trigger: `/battery-passport`
- Mechanism: $299 Payment Link → webhook → 50 gens
- CVR estimate: 1–3% of qualified sessions
- Events: `page_view_battery_passport`, `cta_click_dpp_299`, `checkout_session_completed`
- Kill: 500 sessions / 30 days / 0 paid → change the offer, do not add verticals

Bots may instrument these loops. Bots may not cold-email Mike, Wilson, Louis, Kathryn, Moderna, Verkor, or any MSO.

## Public money URLs

- https://qron.space/generate — $29 / $99
- https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E — Starter $29 (100 gens)
- https://authichain.com/battery-passport — $299 DPP
- https://strainchain.io/onboard — $49 passport
- https://authichain.com/x402 — $0.05 USDC agent verify

Apex CTAs stay `/onboard`, `/dapp`, `/verify`. Never a `*.vercel.app` URL.

## HUMAN-only

- Cloudflare Workers Builds command = `pnpm exec vite build`
- Merge to main
- Stripe live price / bank / tax
- Naming one non-founder To: for the $29 proof, or posting the link on X
- AgentZ `OWNER_LIVE_SEND` / registry `--mode auto`

## Proof still missing

Do not claim: paid customer, published passport in the wild, METRC write, FedRAMP, logos, scan-to-earn. Live customer MRR is $0.
