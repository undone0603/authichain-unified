# GovChain sandbox handoff — 2026-08-28

## Gap fixes landed (same day)

| Gap | Fix |
|---|---|
| Secret split `SAM_GOV_API_KEY` vs `SAM_API_KEY` | Engine accepts either. Preflight and ingest map both secrets. |
| Scheduled runs defaulted live (`dry_run: false`) | Dispatch default is now `true`. Cron always passes `dry_run=true`. Uncheck only for a live manual run. |
| 5-agent consensus was a keyword stub | Weighted Guardian 35 / Archivist 20 / Sentinel 25 / Scout 8 / Arbiter 12 scoring. |
| `mintPilotNFT` threw when not dry-run | Records `gov_proposals` draft row; defers chain mint to `scripts/mint-govchain-nfts.ts`. Mint workflow secrets optional + `continue-on-error`. |
| No `start:gov-engine` script | `pnpm start:gov-engine`, `pnpm gov:engine`, `pnpm gov:monitor`. |

## Local

```bash
pnpm start:gov-engine          # DRY_RUN defaults true
DRY_RUN=false pnpm start:gov-engine
bash scripts/ops/run-gov-engine.sh
bash scripts/ops/monitor-gov-engine.sh
```

## Still deferred (needs chain + contract deploy)

- Live Polygon/Base `mintOpportunityNFT` requires `ALCHEMY_API_KEY`, `POLYGON_PRIVATE_KEY` / `WALLET_PRIVATE_KEY`, `GOVCHAIN_NFT_CONTRACT`.
- Wire the 5-agent module to the product-verification council (this engine now uses the same published weights).
