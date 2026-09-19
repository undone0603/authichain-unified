# Base chain integration — GovChain pilots

Date: 2026-09-17

Funding complete since 2026-09-01. Deploy still unsigned. Public apex is a separate blocker (Cloudflare Access).

## Live probe (2026-09-17 08:33 EDT)

| Account | Base 8453 ETH | Base 8453 USDC | nonce |
|---|---|---|---|
| Smart Wallet `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` | ~0.00170 | 1.0 | 1 |
| Ops EOA `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d` | **0.002** | 0 | **0** |

Fund tx: [`0x4c9ce401…b2145`](https://basescan.org/tx/0x4c9ce401ae191aa48a2703dc21a33638fe2e08a0922344638bcc0febeb2b2145).
No AuthiChainNFT on Base. `gov-mint.yml` has **zero runs** — do not dispatch until `GOVCHAIN_NFT_CONTRACT` has bytecode.

`GET https://authichain.com/` is **302** to `strainchainexecutiveteam.cloudflareaccess.com` (kid `53cc38df…`). Edge-router origin cannot be confirmed from outside Access. See `docs/operations/PUBLIC_LOOP_FREEZE.md`.

## Deploy (signed, ops EOA)

```bash
pnpm exec node scripts/compile-authichain-nft.cjs
CHAIN=base DRY_RUN=false GRANT_SMART_WALLET=true pnpm exec tsx scripts/deploy-authichain-nft-base.ts
```

Then:

```
CHAIN=base
GOVCHAIN_NFT_CONTRACT=<new Base address>
WALLET_PRIVATE_KEY=<ops EOA>
ALCHEMY_API_KEY=<Base app>
DRY_RUN=true
```

Success: `chain=Base (8453)` and non-empty `getCode`. One live mint only after that, `fit_score >= 75`.

`verifyManufacturer(opsEOA)` is required. `GRANT_SMART_WALLET=true` also verifies `0xC0D26735…`.

## Split unchanged

| Asset | Chain |
|---|---|
| ACPT + $QRON | Polygon 137 (`0x4da4…`) |
| GovChain pilot NFTs | **Base 8453** |
| SAM / PII / proposals | Supabase |
