# Base chain integration — GovChain pilots

Date: 2026-08-28

## What is already true

| Layer | State |
|---|---|
| thirdweb | `defineChain(8453)` and `84532` exist in `server/thirdweb.ts` and client libs. Default mint path is still **Polygon 137 / Amoy 80002**. |
| Gov mint script | Was hardcoded to `base-mainnet.g.alchemy.com` but called `mintOpportunityNFT`, which **does not exist** on `AuthiChainNFT.sol`. Live function is `mintProduct`. |
| Live NFT contract | Polygon only: [`0x4da4D2675e52374639C9c954f4f653887A9972BE`](https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE) (16 ACPT). Same address on Base has no bytecode until redeployed. |
| Signer | GovChain public signer / $QRON owner: `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` (Coinbase Smart Wallet). Polygon NFT deployer/minter role is `0xbad4e580…`. |

## Why Base for GovChain

- Coinbase Smart Wallet is native on Base (chain id **8453**, gas = ETH).
- Public RPC `https://mainnet.base.org` is Flashblocks-enabled (~200ms preconfirm); production still needs Alchemy/QuickNode.
- Explorer: https://basescan.org — Sepolia testnet 84532 / https://sepolia.base.org.
- Fits American-infrastructure story without moving $QRON or existing ACPT inventory off Polygon.

## Recommended split

| Asset | Chain | Why |
|---|---|---|
| Product certificates (ACPT) | Polygon 137 | Already live, 16 minted, thirdweb default |
| $QRON | Polygon 137 | Live token + tax/owner wallet |
| GovChain pilot NFTs | **Base 8453** (Sepolia first) | Smart Wallet, cheap ETH gas, Coinbase alignment |
| Verification records | Off-chain + optional Base anchor | Keep SAM PII off-chain |

Do **not** point the Base RPC at the Polygon contract address and expect a mint.

## Ship order

1. Fund `0xC0D26735…` with Base Sepolia ETH (faucet) then a small Base mainnet ETH float.
2. Deploy `contracts/AuthiChainNFT.sol` to Base Sepolia via thirdweb (`defineChain(84532)`), grant `MINTER_ROLE` to the Smart Wallet.
3. Set secrets: `CHAIN=base-sepolia`, `GOVCHAIN_NFT_CONTRACT=<new address>`, `ALCHEMY_API_KEY` (Base app), `WALLET_PRIVATE_KEY` or session key that holds `MINTER_ROLE`.
4. `DRY_RUN=true pnpm exec tsx scripts/mint-govchain-nfts.ts` — must print matching chainId and non-empty `getCode`.
5. Repeat on Base mainnet. Keep Polygon ACPT as the product-auth contract.

## Env

```
CHAIN=base                 # or 8453 | base-sepolia | polygon | 137
ALCHEMY_API_KEY=
WALLET_PRIVATE_KEY=        # also accepts POLYGON_PRIVATE_KEY
CONTRACT_ADDRESS=          # also accepts GOVCHAIN_NFT_CONTRACT
DRY_RUN=true
```

Script: `scripts/mint-govchain-nfts.ts` now probes `eth_chainId` + `getCode` before sending a tx, and calls `mintProduct` (falls back to `mintOpportunityNFT` only if that selector exists).
