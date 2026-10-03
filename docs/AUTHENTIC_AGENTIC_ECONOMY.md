# Authentic Agentic Economy

Status: founder YES on 2026-09-24. Catalog freeze. Not pushed to main in this commit.

One primitive, four faces:

```
object → signed seal (Ed25519 + optional Polygon NFT)
      → human scan  /verify          → Stripe entitlement
      → agent call  POST /api/x402   → $0.05 USDC on Base
      → public receipt
```

A seal proves the record the issuer published has not been altered since it was signed. It does not certify a lab, a government, or that the physical item was never swapped.

## Public money URLs (only these)

| URL | SKU | Price |
|---|---|---|
| https://authichain.com/battery-passport | dpp_readiness | $299 one-time |
| https://qron.space/generate | starter / creator | $29 / $99 one-time |
| https://strainchain.io/onboard | strainchain_passport | $49 one-time |
| https://authichain.com/x402 | agent verify | $0.05 USDC |

Apex product CTAs stay `/onboard`, `/dapp`, `/verify`. Never a `*.vercel.app` URL.

Footnotes, not heroes: StrainChain Farm $149/mo and AuthiChain Basic $149/mo after the first paid seal.

## Hidden this pass (Stripe products stay live)

- `theater_1` $499/mo
- `theater_3` $1499/mo
- StorePilot Pro $29/mo
- AuthiChain Enterprise $1499/mo as a public card
- $10 and $1000 DPP twin prices
- $1 human/agent proof rails as marketed offers

`workers/*` skins (luxechain, rxchain, chipchain, fanchain, harvestchain, glowchain, partchain, provenchain, threadchain, watchchain) are landings. Noindex until a paid seal exists in that category.

## Free trial cap

`free.generations = 5` (was 0 = unlimited). Lookup verify only on the free path. GPT-4V is a paid path.

Signup and webhook provisioners must write `users.generations_limit = 5`, not `0`.

## Use cases that reuse seal + QR + verify + pay

1. Human verify — `/verify`. Miss → `/onboard`.
2. Human issue — `/onboard`, qron.space/generate. Packs start at $29.
3. Battery / EU DPP — `/battery-passport` → $299. Not legal advice. Deadline 18 Feb 2027.
4. StrainChain CoA passport — $49. Totals recomputed from the uploaded panel. Not a METRC replacement.
5. Gov contractor seal — govchain.us copy on the same seal. Not FedRAMP, not SAM.gov.
6. Agent verify — MCP + `POST /api/x402`. Unpaid → HTTP 402.

Wine, pharma packaging, auto parts, luxury receipts, diplomas, tickets are field mappings on the same certificate. Do not build them as products this pass.

## Loops (zero founder time)

### Loop 1 — Battery deadline

- Trigger: `/battery-passport`
- Mechanism: $299 Payment Link → `/api/stripe/webhook` → email + 50 gens
- CVR estimate: 1–3% of qualified sessions
- Events: `page_view_battery_passport`, `cta_click_dpp_299`, `checkout_session_completed`, `entitlement_provisioned`, `first_seal_published`
- Kill: 500 sessions / 30 days / 0 paid → change the offer, do not add verticals

### Loop 2 — Generate → $29

- Trigger: qron.space/generate without a session
- Mechanism: queue a pilot seal + Starter $29 buy link
- CVR estimate: 2–6% of target-URL submits
- Events: `generate_submit_anon`, `cta_click_starter_29`, `checkout_session_completed`, `generation_credit_granted`
- Kill: 200 generate submits / 30 days / 0 paid → keep the 5-gen cap and force checkout

### Loop 3 — Verify miss → onboard

- Trigger: `/verify` unknown or unsigned ID
- Mechanism: "No seal on file. Seal this product — no call." → `/onboard`
- CVR estimate: 5–12% of misses to email; 0.5–2% of those to paid
- Events: `verify_miss`, `onboard_submit`, `checkout_session_completed`
- Kill: welcome email silent for 7 days

### Loop 4 — Agent 402

- Trigger: unpaid `POST /api/x402` or MCP tools/call
- Mechanism: HTTP 402 + $0.05 USDC on Base → retry with `X-PAYMENT`
- CVR estimate: unknown. Daily cap $10/payer already set.
- Events: `x402_challenge`, `x402_settled`, `agent_verify_ok`
- Kill: facilitator down 48h or payTo drift from `0xaebf…e437`

Do not run outreach-trigger, b2b-outreach, ghost-traffic, or brand-pitch microsites as acquisition. Historical result: 0 replies.

## Proof still missing

Do not claim: a paid customer, a published passport in the wild, METRC write, FedRAMP, any logo, scan-to-earn, $QRON consumer rewards. Live customer MRR is $0. One $10 founder self-test is not a customer dollar.

## Workers Builds (HUMAN)

Cloudflare Dashboard → Workers & Pages → `authichain` → Settings → Build → Build command = `pnpm exec vite build` → Save.

Do not merge draft PR #1231 as the only fix. Fold `tailwind-merge` into this freeze PR from current main. Dashboard command is still required after merge.
