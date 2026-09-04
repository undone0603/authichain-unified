# Base chain integration — GovChain pilots

Date: 2026-09-04

Sepolia skipped. Funding complete. Deploy is the next signed step.

## Live probe (2026-09-04 17:36 EDT)

| Account | Base 8453 ETH | Base 8453 USDC | nonce |
|---|---|---|---|
| Smart Wallet `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` | ~0.00170 | 1.0 | 1 (UserOp) |
| Ops EOA `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d` | **0.002** | 0 | **0** |

Fund tx: [`0x4c9ce401…b2145`](https://basescan.org/tx/0x4c9ce401ae191aa48a2703dc21a33638fe2e08a0922344638bcc0febeb2b2145) (block 50760586). Coinbase bundler → EntryPoint 0.6 → 0.002 ETH to ops EOA. Paymaster was `0x0`; gas paid from Smart Wallet ETH.

No AuthiChainNFT bytecode on Base yet. Ops nonce 0 means the deploy key has never sent a Base tx.

Compile path (PR #871): `scripts/compile-authichain-nft.cjs` writes the artifact `scripts/deploy-authichain-nft-base.ts` expects. Hardhat `paths.sources` is still `contracts/ledger` — do not use `npx hardhat compile` for this contract.

## Deploy (signed, ops EOA)

This sandbox cannot hold `WALLET_PRIVATE_KEY`. Run on the machine that has the ops key:

```bash
pnpm exec node scripts/compile-authichain-nft.cjs
CHAIN=base DRY_RUN=false GRANT_SMART_WALLET=true pnpm exec tsx scripts/deploy-authichain-nft-base.ts
```

or `npx thirdweb deploy contracts/AuthiChainNFT.sol` → Base 8453.

`verifyManufacturer(opsEOA)` is required. `GRANT_SMART_WALLET=true` also verifies `0xC0D26735…`.

Then set secrets and dry-run mint:

```
CHAIN=base
GOVCHAIN_NFT_CONTRACT=<new Base address>
WALLET_PRIVATE_KEY=<ops EOA>
ALCHEMY_API_KEY=<Base app>
DRY_RUN=true
```

Success: `chain=Base (8453)` and non-empty `getCode`. Flip `DRY_RUN=false` for one `gov_proposals` row with `fit_score >= 75`.

## Split unchanged

| Asset | Chain |
|---|---|
| ACPT + $QRON | Polygon 137 (`0x4da4…`) |
| GovChain pilot NFTs | **Base 8453** |
| SAM / PII / proposals | Supabase |
