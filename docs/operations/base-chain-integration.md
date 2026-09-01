# Base chain integration — GovChain pilots

Date: 2026-08-31 (mainnet exception authorized)

Sepolia is skipped. Fund path is the 10 USDC on the Coinbase Smart Wallet on Base 8453.

## Live probe (2026-08-31 00:01 EDT)

| Account | Base 8453 ETH | Base 8453 USDC |
|---|---|---|
| Smart Wallet `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` | 0 | **10.0** |
| Ops EOA `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d` | 0 | 0 |
| `0x833589fC…` | Circle USDC contract | not a wallet |

Gas on Base at probe: ~0.006 gwei. A contract deploy is well under $0.05. 10 USDC of ETH is more than enough.

This sandbox cannot sign a Smart Wallet UserOp. The swap has to happen in Coinbase Wallet.

## Swap + fund (you, in Coinbase Wallet)

1. Open Coinbase Wallet → network **Base**.
2. Confirm the 10 USDC is on `0xC0D26735…`.
3. Swap **9 USDC → ETH**. Leave 1 USDC if you want a stable remainder. Coinbase’s Base paymaster usually sponsors the swap gas so you do not need ETH first.
4. Send **0.002 ETH** to the ops EOA:
   `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d`
   Keep the rest in the Smart Wallet.
5. Reply with the two BaseScan links (swap + transfer). Deploy runs after `eth_getBalance(opsEOA) > 0` on 8453.

Do not send USDC to the ops EOA. The deploy script pays gas in ETH from an ethers-signed EOA. The USDC contract cannot sign.

## After the ops EOA has ETH

```bash
CHAIN=base DRY_RUN=false GRANT_SMART_WALLET=true pnpm exec tsx scripts/deploy-authichain-nft-base.ts
```

or `npx thirdweb deploy contracts/AuthiChainNFT.sol` → **Base** (8453).

Then:

```
CHAIN=base
GOVCHAIN_NFT_CONTRACT=<new Base address>
WALLET_PRIVATE_KEY=<ops EOA>
ALCHEMY_API_KEY=<Base app>
DRY_RUN=true
```

`pnpm exec tsx scripts/mint-govchain-nfts.ts` — success is `chain=Base (8453)` and non-empty `getCode`.

Flip `DRY_RUN=false` for one `gov_proposals` row with `fit_score >= 75`.

`verifyManufacturer(opsEOA)` is required (`MINTER_ROLE` alone reverts). `GRANT_SMART_WALLET=true` also verifies `0xC0D26735…` so Coinbase Wallet can mint later.

## Split unchanged

| Asset | Chain |
|---|---|
| ACPT + $QRON | Polygon 137 (`0x4da4…`) |
| GovChain pilot NFTs | **Base 8453** |
| SAM / PII / proposals | Supabase |
