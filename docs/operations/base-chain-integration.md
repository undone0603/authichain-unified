# Base chain integration — GovChain pilots

Date: 2026-09-19 (item 5 still open)

Funding complete since 2026-09-01. **AuthiChainNFT is not on Base yet.** Public apex / Access is a separate blocker (`docs/operations/PUBLIC_LOOP_FREEZE.md`).

## Live probe (2026-09-19)

| Account | Base 8453 ETH | nonce | notes |
|---|---|---|---|
| Smart Wallet `0xC0D26735fd9e868eacc60400ef3171Fa4161177f` | ~0.00170 (2026-09-17) | 1 | recipient / optional `verifyManufacturer` only |
| Ops EOA `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d` | **0.002** | **0** | signer for deploy + mint |

Fund tx: [`0x4c9ce401…b2145`](https://basescan.org/tx/0x4c9ce401ae191aa48a2703dc21a33638fe2e08a0922344638bcc0febeb2b2145).

Reconfirmed 2026-09-19 against `https://mainnet.base.org`:

- Ops EOA `eth_getBalance` = `0x71afd498d0000` (0.002 ETH), `eth_getTransactionCount` = `0x0`.
- Polygon AuthiChainNFT `0x4da4D2675e52374639C9c954f4f653887A9972BE` has **`eth_getCode = 0x` on Base 8453**. That address is live on Polygon 137 only.

`GOVCHAIN_NFT_CONTRACT` is **not set to a Base address**. `gov-mint.yml` (id `304825951`) stays **disabled** until a Base getCode proof exists.

## Item 5 status

| Gate | Status |
|---|---|
| Ops EOA funded on Base | yes |
| Actions secrets `WALLET_PRIVATE_KEY` or `POLYGON_PRIVATE_KEY` | owner-confirmed present |
| `ALCHEMY_API_KEY` | owner: likely present (public Base RPC is the fallback) |
| AuthiChainNFT bytecode on 8453 | **no** |
| GitHub secret `GOVCHAIN_NFT_CONTRACT` (Base) | **do not set until the live deploy prints an address** |
| `gov-mint.yml` enabled | **no** — enable only after getCode proof, dry-run default true |

## Deploy (Actions — preferred)

Workflow: `.github/workflows/deploy-govchain-nft-base.yml`  
Name: **Deploy AuthiChainNFT (GovChain) to Base**

Compile path: `pnpm gov:compile-nft` → `artifacts/contracts/AuthiChainNFT.sol/AuthiChainNFT.json`  
Deploy script: `pnpm gov:deploy-base` → `scripts/deploy-authichain-nft-base.ts`  
Hardhat `npx hardhat compile` does **not** emit AuthiChainNFT (sources stay `contracts/ledger`).

### Secrets (never paste values into issues, PR comments, or logs)

| Secret | Required for live deploy | Role |
|---|---|---|
| `WALLET_PRIVATE_KEY` or `POLYGON_PRIVATE_KEY` | yes | ops EOA `0xbad4…` (not the Smart Wallet) |
| `ALCHEMY_API_KEY` | no | Base RPC; falls back to `https://mainnet.base.org` |
| `GOVCHAIN_NFT_CONTRACT` | no | if set and `getCode != 0x`, **grant-only** (no new create) |

### Dispatch after this workflow is on `main`

1. Optional sanity (no tx):

```bash
gh workflow run deploy-govchain-nft-base.yml --ref main \
  -f dry_run=true -f chain=base -f grant_smart_wallet=true
```

UI: Actions → **Deploy AuthiChainNFT (GovChain) to Base** → leave **dry_run checked**, `chain=base`, **grant_smart_wallet checked**.

2. Signed live deploy (spends ops EOA gas; do this once):

```bash
gh workflow run deploy-govchain-nft-base.yml --ref main \
  -f dry_run=false -f chain=base -f grant_smart_wallet=true
```

UI: same workflow → **uncheck dry_run**, `chain=base`, grant_smart_wallet checked → Run.

3. From the job summary or the `authichain-nft-deploy-base` artifact (`deployments/AuthiChainNFT.base.json`), copy `address`.

4. Set Actions secret `GOVCHAIN_NFT_CONTRACT` to that address. Also keep `CHAIN=base` for mint.

5. Verify bytecode (must **not** be `"0x"`):

```bash
ADDR=<paste Base address>
curl -sS -X POST https://mainnet.base.org \
  -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getCode\",\"params\":[\"${ADDR}\",\"latest\"]}"
```

Basescan: `https://basescan.org/address/<ADDR>`  
Optional Basescan API: `https://api.basescan.org/api?module=proxy&action=eth_getCode&address=<ADDR>&tag=latest`

Success: `chain=Base Mainnet (8453)` in the deploy logs, `getCode_bytes` > 0, explorer page shows a contract.

`verifyManufacturer(opsEOA)` runs on every live deploy. `GRANT_SMART_WALLET=true` also verifies `0xC0D26735…`.

## Enable gov-mint (dry-run only)

Only after step 5 above (real Base bytecode):

```bash
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/304825951/enable
gh workflow run gov-mint.yml --ref main -f dry_run=true -f chain=base
```

`gov-mint.yml` defaults `dry_run=true` and now fails a **live** mint if getCode is empty. Do **not** dispatch `dry_run=false` until that dry-run is green **and** getCode is still non-empty. One live mint only after that, `fit_score >= 75`.

### Sibling gov-* enable order (after mint dry-run is green)

Lowest blast first. Cron on `gov-engine` keeps score / proposals / mint / notify dry.

| Order | Workflow | id | Notes |
|---|---|---|---|
| 1 | gov-ingest.yml | 304824543 | SAM.gov → Supabase; no chain writes |
| 2 | gov-score.yml | 304825517 | model credits |
| 3 | gov-proposals.yml | 304825758 | drafts outbound content |
| 4 | gov-mint.yml | 304825951 | **this gate** — enable with dry_run default true |
| 5 | gov-notify.yml | 304826125 | Slack digest |
| 6 | gov-engine.yml | 261329391 | orchestrator; scheduled mint stays dry |

```bash
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/304824543/enable
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/304825517/enable
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/304825758/enable
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/304825951/enable
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/304826125/enable
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/261329391/enable
```

## Local fallback (same script the workflow runs)

```bash
pnpm gov:compile-nft
CHAIN=base DRY_RUN=true  GRANT_SMART_WALLET=true pnpm gov:deploy-base
CHAIN=base DRY_RUN=false GRANT_SMART_WALLET=true pnpm gov:deploy-base
```

Required to send a tx: `WALLET_PRIVATE_KEY` or `POLYGON_PRIVATE_KEY`, funded ops EOA. Optional: `ALCHEMY_API_KEY`, `GOVCHAIN_NFT_CONTRACT` (grant-only), `ARTIFACT_PATH`.

Then mint dry-run:

```
CHAIN=base
GOVCHAIN_NFT_CONTRACT=<new Base address>
WALLET_PRIVATE_KEY=<ops EOA>
ALCHEMY_API_KEY=<Base app>
DRY_RUN=true
pnpm exec tsx scripts/mint-govchain-nfts.ts
```

## Polygon interim (only if Base deploy cannot land)

Prefer completing the Base deploy. If the owner explicitly accepts Polygon as an interim pilot:

```
CHAIN=polygon
GOVCHAIN_NFT_CONTRACT=0x4da4D2675e52374639C9c954f4f653887A9972BE
```

Confirm `eth_getCode` on Polygon 137 (not Base) before enabling mint with `chain=polygon`. Product certificates stay on Polygon; GovChain pilots are still intended for Base.

## Split unchanged

| Asset | Chain |
|---|---|
| ACPT + $QRON | Polygon 137 (`0x4da4D2675e52374639C9c954f4f653887A9972BE`) |
| GovChain pilot NFTs | **Base 8453** (address TBD — fill after live deploy) |
| SAM / PII / proposals | Supabase |

## After a real Base address exists

Replace this line in this file and in `PUBLIC_LOOP_FREEZE.md` item 5:

- `GOVCHAIN_NFT_CONTRACT=<address>`
- Basescan: `https://basescan.org/address/<address>`
- getCode proof: RPC result ≠ `0x` on 8453
