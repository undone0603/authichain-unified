# AuthiChain web3 identity — wallets, chains, tokens, rails

**Date:** 2026-09-21 · **Status:** canonical · **Brand:** AuthiChain (a brand, not a corporation) · **SAM legal entity:** ZACHARY KIETZMAN (sole proprietor).

This is the **source of truth** for AuthiChain on-chain identity. Do not invent addresses, rotate `X402_PAY_TO`, add `$QRON` to x402 `accepts[]`, or treat govchain.us staking numbers as live tokenomics.

Owner-authorized x402 payTo is the owner's keyed EOA `0x5db5…6AA2`. **Never** bind `X402_PAY_TO` to `0xAebf…E437` — that is the `$QRON` ERC-20 contract on Polygon (no code and no key on Base; USDC sent there on Base is stuck).

Economics of the **live agent rail** stay in [`AGENT_TOKENOMICS_x402.md`](./AGENT_TOKENOMICS_x402.md). Human SKUs stay in `src/lib/plans.ts`. Stripe plan-detection IDs stay in `shared/pricing.ts`. Contract bytecode details stay in `contracts/README.md`.

---

## 1. Three money rails (do not mix)

| Rail | Buyer | Asset / SKU | Chain or processor | Recipient | Source of truth |
| --- | --- | --- | --- | --- | --- |
| **Stripe** (human checkout) | Person with a card | Passport **$49** · DPP **$299** · QRON packs / credits | Stripe acct `acct_1SXIyEGqTruSqV8T` | Stripe, not these wallets | `src/lib/plans.ts` |
| **x402** (agent pay) | Funded agent wallet | Circle **USDC**, **$0.05 / call** | **Base 8453** | payTo / tokenomics EOA `0x5db5…6AA2` | `src/lib/x402.ts` + live health |
| **$QRON** (ERC-20) | n/a — **not a payment rail** | 1,000,000,000 supply, 18 decimals | **Polygon 137** | Contract `0xAebf…E437`; held almost entirely by `0x5db5…6AA2` | This file + `contracts/README.md` |

A passport or DPP purchase does **not** credit x402 calls. An x402 payment does **not** publish a genetics passport. `$QRON` does **not** settle agent pay. Live operator decision (2026-08-07, still in force): **USDC only** on the paid agent path.

---

## 2. Canonical wallet map (do not invent addresses)

Checksum as written. Same 20 bytes on every EVM chain; **role is chain-specific**.

| Address | Canonical name | Kind | Role |
| --- | --- | --- | --- |
| `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` | **Coinbase Smart Wallet** | ERC-4337 smart account | `$QRON` owner / tax. `GOVCHAIN_SIGNER`. Human Coinbase Wallet (org.toshi / WebAuthn) only. **Cannot** sign with `ethers.Wallet`. |
| `0x5db511706FB6317cd23A7655F67450c5AC6e6AA2` | **payTo / tokenomics EOA** (also `$QRON` holder) | EOA (EIP-7702-delegated on Base) | Owner's keyed wallet. Live x402 payTo — receives **Base USDC** (`X402_PAY_TO`). Also holds nearly all Polygon `$QRON`. <!-- pragma: allowlist secret --> |
| `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d` | **NFT deployer EOA** | EOA | AuthiChainNFT deploy + mint signer. `WALLET_PRIVATE_KEY` / `POLYGON_PRIVATE_KEY`. **Distinct from `0x5db5…`.** |
| `0x8df0057ffb210444b927511b2d416ad7854fb81e` | **$QRON factory caller** | EOA | Historical Smithii factory caller. Not an ops wallet. |
| `0xAebfA6b08fb25b59748c93273aB8880e20FfE437` | **$QRON ERC-20** | Contract | Token contract on Polygon. **Not a wallet. Never a payTo** — `eth_getCode` is empty on Base and nobody holds a key for it there. | // pragma: allowlist secret
| `0x4da4D2675e52374639C9c954f4f653887A9972BE` | **AuthiChainNFT** | Contract | ERC-721 on **Polygon 137 only**. `getCode` is empty on Base 8453. |
| `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | **Circle USDC (Base)** | Contract | x402 `asset`. **Do not rebind.** |
| `0x52981cd11973f954d9ea084a784650f65d052235` | **NFT-cluster address** | EOA | Known AuthiChainNFT recipient cluster (`scripts/ledger/reconstruct-authichain-nft-ledger.ts`). Not an ops wallet; do not grant it new roles by default. |

Named exports that match this table live in `scripts/lib/evm-chains.ts`. `src/lib/x402.ts` re-exports the same bytes as `X402_PUBLISHED_PAY_TO` (`TOKENOMICS_PAY_TO`) and `BASE_USDC_ASSET` (`BASE_USDC`). Public HTML copies them via `workers/authichain-com/src/x402-docs-page.ts` (`X402_PUBLIC`). Values must stay identical. Runtime x402 still reads `X402_PAY_TO` from the Worker binding — do not hardcode a new default that changes 503-vs-402 behavior. Stripe dollar amounts on catalogs come from `src/lib/plans.ts` (`planUsd`).

---

## 3. One owner EOA, two rails

The owner's keyed EOA `0x5db5…6AA2` is both the x402 recipient and the `$QRON` holder, on different chains:

- **Base 8453:** `0x5db5…6AA2` receives Circle USDC (`X402_PAY_TO`).
- **Polygon 137:** `0x5db5…6AA2` holds nearly all `$QRON` (token move below).

Never set `payTo` to the `$QRON` contract `0xAebf…E437`. Do not assume Polygon `$QRON` balance funds Base USDC payments.

---

## 4. Smart Wallet vs EOA vs infrastructure

| Thing | Address | What it is | What it is not |
| --- | --- | --- | --- |
| Coinbase Smart Wallet | `0xC0D2…177f` | ERC-4337 account; human Coinbase actions; `$QRON` owner/tax | An EOA. `ethers.Wallet` cannot operate it. |
| payTo / tokenomics EOA (`$QRON` holder) | `0x5db5…6AA2` | Owner's keyed wallet; live x402 `payTo`; holds nearly all Polygon `$QRON` | Not `WALLET_PRIVATE_KEY`. |
| `$QRON` ERC-20 | `0xAebf…E437` | Token contract on Polygon | A wallet or x402 `payTo`. |
| NFT deployer EOA | `0xbad4…2b0d` | Deploy + mint signer | x402 `payTo`. Not the Smart Wallet. |
| Pimlico bundler | `0x4337015333e7c8a3c5af4ACD2c4aA4bEfb0D663C` | ERC-4337 bundler (infrastructure) | An AuthiChain owner wallet. |
| EntryPoint 0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Canonical ERC-4337 EntryPoint | An AuthiChain owner wallet. |

Never label the bundler or EntryPoint as “ops”, “owner”, or “treasury”.

---

## 5. Owner-reviewed mixed-wallets transaction

Owner review (2026-09-21) of [Polygonscan `0x3f841e1b…201a`](https://polygonscan.com/tx/0x3f841e1bd16ffad4431a91540c6d93c81f02dba26a04fc4d86b0816a8cbf201a) (5 Feb 2026):

1. **Outer tx** is ERC-4337: Pimlico bundler `0x4337…663C` → EntryPoint 0.6.0 `0x5FF1…2789`.
2. **Actual token move:** Coinbase Smart Wallet `0xC0D2…177f` transferred **999,999,992.35 `$QRON`** to the `$QRON` holder EOA `0x5db5…6AA2` (also the live x402 payTo).
3. Calldata shows **org.toshi / WebAuthn** (Coinbase Wallet). That is why `ethers.Wallet` cannot sign as `0xC0D2…`.
4. Total `$QRON` supply is **1,000,000,000** (18 decimals) at `0xAebf…E437`. After this transfer, `0x5db5…` holds nearly all of it.

Use this tx when someone asks “which wallet is ops?” — it shows Smart Wallet, the `$QRON` holder / x402 payTo EOA, bundler, and EntryPoint in one place.

---

## 6. `$QRON` is not live tokenomics

- Contract exists on Polygon. Supply is **1B**, not 100M.
- **Not** the x402 payment rail. Do not add it to `accepts[]`.
- **govchain.us staking theater** (`src/app/governance/page.tsx`, `src/app/api/governance/route.ts` — “100,000,000 circulating”, “42,000,000 circulating”, “18,500,000 staked”) is **not live**. Do not quote those figures as tokenomics. Do not thaw `gov-mint` to make them real.
- QRON **Living QR packs / credits** on Stripe are a product brand (`qron.space`), not token payments.

---

## 7. Do not mix — checklist

1. Use these names: **`0x5db5…6AA2` = payTo / tokenomics EOA** (live `X402_PAY_TO`, also `$QRON` holder); **`0xAebf…E437` = `$QRON` ERC-20 contract** (never a wallet or payTo); **`0xbad4…` = NFT deployer**.
2. Live Base USDC (`X402_PAY_TO`) lands on `0x5db5…6AA2`. Never put `0xAebf…E437` on catalog/health.
3. Coinbase Smart Wallet ≠ any EOA. Do not put its key in `WALLET_PRIVATE_KEY` (there isn’t one for `ethers.Wallet`).
4. `$QRON` ≠ x402. Live agent pay is **Base USDC $0.05 only**.
5. Stripe (Passport $49 / DPP $299 / QRON packs) is a **third** money path and does not use these wallets.
6. Pimlico bundler / EntryPoint are **infrastructure**, not owner wallets.
7. govchain.us staking UI is **theater**, not circulating supply.

**Forbidden:** invent Stripe prices; bind `X402_PAY_TO` to anything other than the owner EOA `0x5db5…6AA2` (in particular the `$QRON` contract `0xAebf…E437`); rebind `X402_USDC_ASSET` / `X402_FACILITATOR_URL`; enable Workers Paid; thaw live `gov-mint`; deploy new contracts from this document.

---

## 8. Related documents

| Doc | Role after this file |
| --- | --- |
| **This file** | Canonical wallets / chains / tokens / rails. |
| `docs/strategy/AGENT_TOKENOMICS_x402.md` | Live x402 economics + paid-vs-free audit. Defers identity here. |
| `docs/operations/base-chain-integration.md` | Base AuthiChainNFT deploy runbook. Signer = **NFT deployer EOA**. |
| `docs/operations/PUBLIC_LOOP_FREEZE.md` | Freeze / item 5. Same deployer name. |
| `contracts/README.md` / `packages/contracts/` | Bytecode, deploy txs, roles. Pointers here for wallet names. |
| `src/lib/plans.ts` | Anything that **charges a human**. |
| `src/lib/x402.ts` | Anything that **charges an agent**. |
| `src/lib/authentic-economy.ts` | Speculative `$QRON` fee_flow / staking-discount math. **Not** settlement. Consumes `TOKENOMICS_PAY_TO` / `QRON_HOLDER_EOA` / `QRON_ERC20` from `scripts/lib/evm-chains.ts` and `X402_PUBLISHED_PAY_TO` / `BASE_USDC_ASSET` from `src/lib/x402.ts`. |

Code comments that still say “ops EOA” should be read as whichever row in §2 the address matches — then renamed when that file is touched.
