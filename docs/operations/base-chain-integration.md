# Base chain integration — GovChain pilots

Date: 2026-08-28 (updated same day: Sepolia ship path)

## Live probe (2026-08-28)

| Check | Result |
|---|---|
| `0xC0D26735…` Base mainnet / Sepolia `getCode` | `0x` (counterfactual Smart Wallet until first UserOp) |
| `0xC0D26735…` ETH balance on 8453 and 84532 | `0` |
| Polygon deployer `0xbad4e580…` on Base Sepolia | `0` ETH |
| `0x4da4…` on Base Sepolia | no bytecode |

Cannot deploy or mint until an **ops EOA** has Base Sepolia ETH. Faucets will not drip to this sandbox; claim in browser against the ops EOA.

## What is already true

| Layer | State |
|---|---|
| thirdweb | `defineChain(8453)` and `84532` exist in `server/thirdweb.ts` and client libs. Default mint path is still **Polygon 137 / Amoy 80002**. |
| Gov mint script | `scripts/mint-govchain-nfts.ts` probes `eth_chainId` + `getCode`, calls `mintProduct`. |
| Deploy / roles script | `scripts/deploy-authichain-nft-base.ts` |
| Live NFT contract | Polygon only: [`0x4da4D2675e52374639C9c954f4f653887A9972BE`](https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE) (16 ACPT). |
| Signer split | Public recipient / $QRON owner: `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` (Coinbase Smart Wallet). Ops minter: `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d`. |

## Role gotcha — `MINTER_ROLE` is not enough

`mintProduct` reverts `UnauthorizedManufacturer` unless `msg.sender` is in `_verifiedManufacturers` **or** holds `DEFAULT_ADMIN_ROLE`.

```solidity
if (!_verifiedManufacturers[msg.sender] && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender))
    revert UnauthorizedManufacturer(msg.sender);
```

Constructor only verifies the deployer. Use `verifyManufacturer(opsEOA)` which also grants `MINTER_ROLE`. Do not only call `grantRole`.

Do **not** put a Smart Wallet key in `WALLET_PRIVATE_KEY`. There isn't one ethers can use.

## Why Base for GovChain

- Coinbase Smart Wallet is native on Base (8453, gas = ETH).
- Public RPC `https://mainnet.base.org` is rate-limited; production uses Alchemy / CDP Node.
- Explorer: https://basescan.org — Sepolia 84532 / https://sepolia.basescan.org.
- Keep $QRON and ACPT inventory on Polygon.

## Recommended split

| Asset | Chain | Why |
|---|---|---|
| Product certificates (ACPT) | Polygon 137 | Already live |
| $QRON | Polygon 137 | Live token + tax/owner wallet |
| GovChain pilot NFTs | **Base Sepolia → Base 8453** | Smart Wallet, cheap ETH gas |
| SAM / PII / proposals | Supabase | Never on-chain |

## Ship order (ops EOA, not Smart Wallet)

1. Claim Base Sepolia ETH to the **ops EOA** (`0xbad4e580…` or a new EOA you control):
   - https://www.alchemy.com/faucets/base-sepolia
   - https://portal.cdp.coinbase.com/products/faucet
   - https://docs.base.org/base-chain/network-information/network-faucets
2. Deploy `contracts/AuthiChainNFT.sol` to Base Sepolia:
   - Preferred: `npx thirdweb deploy contracts/AuthiChainNFT.sol` → Base Sepolia.
   - Or compile an artifact, then `CHAIN=base-sepolia DRY_RUN=false pnpm exec tsx scripts/deploy-authichain-nft-base.ts`.
3. `verifyManufacturer(opsEOA)` (script does this for the signing wallet). Optionally `GRANT_SMART_WALLET=true` so the Smart Wallet can mint from Coinbase Wallet later.
4. GitHub / local secrets:

```
CHAIN=base-sepolia
GOVCHAIN_NFT_CONTRACT=<new Base Sepolia address>
ALCHEMY_API_KEY=<Base app>
WALLET_PRIVATE_KEY=<ops EOA, not the Smart Wallet>
DRY_RUN=true
```

5. `pnpm exec tsx scripts/mint-govchain-nfts.ts` — success is `chain=Base Sepolia (84532)` and non-empty `getCode`. `DRY_RUN=true` does not send a tx.
6. `DRY_RUN=false` for one `gov_proposals` row with `fit_score >= 75`.
7. Repeat on Base mainnet only after a Sepolia receipt is on sepolia.basescan.org.

Hardhat `paths.sources` is still `contracts/ledger`. `npx hardhat compile` will **not** emit AuthiChainNFT until that path is widened on purpose.

## Env

```
CHAIN=base-sepolia         # or 84532 | base | 8453 | polygon | 137
ALCHEMY_API_KEY=
WALLET_PRIVATE_KEY=        # ops EOA; also accepts MINTER_PRIVATE_KEY / POLYGON_PRIVATE_KEY
GOVCHAIN_NFT_CONTRACT=     # also CONTRACT_ADDRESS
GRANT_SMART_WALLET=false
DRY_RUN=true
```
