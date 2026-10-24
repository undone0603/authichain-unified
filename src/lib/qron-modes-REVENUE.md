# QRON Modes Revenue Notes

Modes (Stellar Seal, Batch Verify, Limited Drop, etc.) are free selectable prompt templates inside existing paid packs.

## Live packs (from src/lib/plans.ts)
- Starter Pack: $29 one-time / 100 generations
- QRON Launch: $19/mo / 100 generations/mo (listed: false)
- QRON Launch Annual: $190/yr / 1,200 generations (listed: false)
- Creator Pack: $99 one-time / 500 generations

## Unit economics (estimates)
- COGS per generation: ~$0.02–0.05 (Cloudflare Workers + image inference)
- Gross margin: 85–93% on Starter
- No incremental COGS for modes
- Self-serve only. No founder action per customer.

## Expansion
- Soft annual CTA after mode use (existing SKU)
- Soft upgrade when remaining credits low
- No new Stripe products required

## Decision
No pricing decision required. Feature expansion only.
