# Base chain integration — GovChain pilots

Date: 2026-08-31 (probe refreshed)

## Live probe (2026-08-31 21:58 UTC)

| Check | Result |
|---|---|
| `0xC0D26735…` Base mainnet / Sepolia `getCode` | `0x` (counterfactual Smart Wallet until first UserOp) |
| `0xC0D26735…` ETH on 8453 and 84532 | `0` |
| Ops EOA `0xbad4e580…` on Base Sepolia | `0` ETH |
| `0x4da4…` on Base Sepolia | no bytecode |

Cannot deploy or mint until an **ops EOA** has Base Sepolia ETH. Faucets will not drip from this sandbox; claim in a browser against the ops EOA.

`gov-mint.yml` now accepts `workflow_dispatch` and passes `CHAIN` (default `base-sepolia`). It still will not send a tx with empty bytecode or `DRY_RUN=true`.

## What is already true

| Layer | State |
|---|---|
| thirdweb | `defineChain(8453)` and `84532` exist. Default mint path was Polygon; Actions now default to Base Sepolia. |
| Gov mint script | `scripts/mint-govchain-nfts.ts` probes `eth_chainId` + `getCode`, calls `mintProduct`. |
| Deploy / roles script | `scripts/deploy-authichain-nft-base.ts` |
| Live NFT contract | Polygon only: [`0x4da4D2675e52374639C9c954f4f653887A9972BE`](https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE) (16 ACPT). |
| Signer split | Public recipient / $QRON owner: `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` (Coinbase Smart Wallet). Ops minter: `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d`. |

## Role gotcha — `MINTER_ROLE` is not enough

`mintProduct` reverts `UnauthorizedManufacturer` unless `msg.sender` is in `_verifiedManufacturers` **or** holds `DEFAULT_ADMIN_ROLE`.

Constructor only verifies the deployer. Use `verifyManufacturer(opsEOA)` which also grants `MINTER_ROLE`. Do not only call `grantRole`.

Do **not** put a Smart Wallet key in `WALLET_PRIVATE_KEY`. There isn't one ethers can use.

## Recommended split

| Asset | Chain | Why |
|---|---|---|
| Product certificates (ACPT) | Polygon 137 | Already live |
| $QRON | Polygon 137 | Live token + tax/owner wallet |
| GovChain pilot NFTs | **Base Sepolia → Base 8453** | Smart Wallet, cheap ETH gas |
| SAM / PII / proposals | Supabase | Never on-chain |

## Ship order (ops EOA, not Smart Wallet)

1. Claim Base Sepolia ETH to **`0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d`**:
   - https://www.alchemy.com/faucets/base-sepolia
   - https://portal.cdp.coinbase.com/products/faucet
2. Deploy `contracts/AuthiChainNFT.sol` to Base Sepolia (`thirdweb deploy` or `CHAIN=base-sepolia DRY_RUN=false pnpm exec tsx scripts/deploy-authichain-nft-base.ts`).
3. `verifyManufacturer(opsEOA)` (deploy script does this for the signer). Optional `GRANT_SMART_WALLET=true`.
4. Secrets: `CHAIN=base-sepolia`, `GOVCHAIN_NFT_CONTRACT=<new>`, `WALLET_PRIVATE_KEY=<ops EOA>`, `ALCHEMY_API_KEY`, `DRY_RUN=true`.
5. `pnpm exec tsx scripts/mint-govchain-nfts.ts` — success is `chain=Base Sepolia (84532)` and non-empty `getCode`.
6. `DRY_RUN=false` for one `gov_proposals` row with `fit_score >= 75`.
7. Base mainnet only after a Sepolia receipt is on sepolia.basescan.org.

Hardhat `paths.sources` is still `contracts/ledger`. `npx hardhat compile` will not emit AuthiChainNFT until that path is widened.
