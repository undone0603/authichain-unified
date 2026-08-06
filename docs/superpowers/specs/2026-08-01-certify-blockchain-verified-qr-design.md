# Certify — Self-Serve Blockchain-Verified Product Certificates — Design Spec

**Date:** 2026-08-01
**Status:** Draft, pending owner review

## Context

The owner runs four brands (AuthiChain, QRON, GovChain, StrainChain) as one Next.js
app (see `authichain-ecosystem-architecture` history: one repo, one Vercel project,
per-domain routing via `shared/brands.ts`). Prior audits this same week established
two hard facts that constrain this design:

1. **Real Stripe revenue to date is $0**, despite live pricing (QRON packs, Theater
   1/3 enterprise subscriptions) existing for months. The bottleneck has repeatedly
   been traffic/conversion, not missing payment plumbing.
2. This codebase has a documented history of **silent fabrication** — code that
   returns success-shaped responses without the underlying real action happening
   (fake HubSpot pipeline, simulated blockchain tx hashes, a gateway worker that
   explicitly runs in "demo mode"). Anything this design builds must fail loudly,
   not silently, when a real on-chain action doesn't happen.

AuthiChain's own tagline is "blockchain-verified seals... for supply chains" — this
is already the intended product, not a new idea. What's missing is a working,
self-serve path from a stranger with a product to a real, verifiable on-chain
certificate, paid for without any human in the loop.

**Verified this session, directly against Polygon mainnet (not assumed from code):**
- `AuthiChainNFT` (`0x4da4D2675e52374639C9c954f4f653887A9972BE`) is a real,
  source-verified ERC-721 contract with 16 real "Mint Product" transactions from
  ~294 days ago, all from deployer address `0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d`.
- That constructor grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `UPDATER_ROLE`, and
  `PAUSER_ROLE` **exclusively** to the deployer address — no other admin path exists
  on this contract. The owner has confirmed they still hold this key.
- The owner also confirmed control of a Bitcoin Taproot address
  (`bc1p4h65dehptlyr5wufw8d9zgga47jfak85hx5zymms4q4atllm2xcsm9vz4m`), relevant to
  the deferred Bitcoin phase below.
- The `$QRON` ERC-20 token is also really deployed on Polygon mainnet but has zero
  real trading/holder activity — not a revenue lever, out of scope here.

**What's currently broken, found by reading the actual code (not assumed):**
- `src/lib/blockchain.ts` / `src/actions/anchor.ts` (the real, honestly-written
  ethers.js anchoring code — it fails with a clear error rather than faking a tx
  hash) require `AUTHICHAIN_CONTRACT_ADDRESS` and `BLOCKCHAIN_PRIVATE_KEY` env
  vars. **Neither is currently set** as a repo/Vercel secret. Every call today
  hits the "Blockchain configuration missing" branch.
- `/api/seal` and `/api/certificate` (the existing "industrial API," gated by an
  `X-API-Key` header) don't call that ethers.js code directly — they proxy to
  `${WORKER_URL}/anchor` and `${WORKER_URL}/mint-nft`, and `WORKER_URL` /
  `WORKER_API_KEY` are also unset. The failure is caught and logged as "non-fatal,"
  and **the API still returns 200 with `polygon_tx: null`** — a customer-visible
  success response for a certificate that was never actually anchored.
- Separately, `/api/seal`'s generated verify URL (`/verify?seal=<uuid>&hash=...`)
  doesn't match what `src/app/verify/page.tsx` actually reads (`?id=<numeric
  product id>&hash=...`, looked up in the `products` Drizzle table). **These two
  systems have diverged** — the industrial API's own QR codes point at a verify
  page that can't resolve them. The `/verify` page's data model (`products`,
  `qr_codes`, `supply_chain_events` via Drizzle) is the more complete one: it
  already renders real product/provenance data and already has a real (if
  partial — see below) Bitcoin Ordinals status check via the public Hiro API.
  This design builds on that model, not the separate `auth_seals`/`certificates`
  Supabase-client tables `/api/seal`/`/api/certificate` use.
- `server/ordinals-service.ts` can genuinely check a real inscription's status
  (`api.hiro.so`, a real public Ordinals indexer) but has no code to actually
  *create* a new Bitcoin inscription — `prepareOrdinalEnvelope` is an
  unimplemented stub. Reading is real; writing doesn't exist yet.
- The repo has a duplicated app structure (`apps/qron-platform/` vs. root `src/`)
  with overlapping files. Per the established practice already used elsewhere in
  this repo (verify the real deploy source via `vercel project inspect` /
  `get_deployment` before editing), **implementation must confirm which tree is
  actually live before touching either.**

## Goals

- A real self-serve flow: pay once, get a product certificate that is genuinely
  minted on the already-deployed, already-proven `AuthiChainNFT` contract on
  Polygon mainnet.
- No silent failure path: if the on-chain mint doesn't succeed, the customer is
  not charged a completed "certified" status and the certificate record reflects
  that honestly.
- Reuse existing, working infrastructure wherever it exists: the `PLANS` /
  `/api/checkout` / `/api/stripe/webhook` billing pipeline already used by QRON's
  real packs, and the `/verify` page's existing data model.
- Usable from all four brand domains with brand-appropriate framing, one shared
  backend (matching the existing `shared/brands.ts` pattern).

## Non-goals (this phase)

- Real Bitcoin Ordinals **inscription creation**. The read/verify half already
  works; building real commit/reveal inscription logic (or integrating a
  third-party inscription API against the owner's real Taproot address) is a
  follow-on phase once Polygon-based Certify is live and actually selling.
- Fixing or unifying the separate `auth_seals`/`certificates` industrial-API
  tables — flagged as diverged, not migrated in this phase. The existing
  `X-API-Key`-gated `/api/seal`/`/api/certificate` routes are left as-is;
  reconciling them is a separate cleanup, not required to ship Certify.
- Credit packs or enterprise-tier bundling for certificates — single one-time
  purchase only, per the pricing decision below.
- Any new payment system — Certify is a new `PLANS` entry through the existing
  checkout/webhook pipeline, not a parallel Stripe integration.

## Pricing

**$19, one-time, per certificate.** Added as a new entry in `src/lib/plans.ts`
(`stripe_mode: 'payment'`), with a real Stripe Price created the same way existing
prices were ("pre-created in the Stripe dashboard... keep in sync"). Rationale:
real Polygon gas per mint is fractions of a cent, so margin is large even at a low
price, and the existing $499/$1,499 enterprise tiers are exactly the SKUs that
have never converted from cold traffic — they need a sales relationship this
project doesn't build. A single cheap, obvious self-serve purchase is the lowest-
friction path to a first real sale. Bundles/enterprise upsell are legitimate later
additions once there's a real buyer to upsell.

## Architecture

**Phase 1 — make the existing anchoring code real:**
1. Add `AUTHICHAIN_CONTRACT_ADDRESS` and `BLOCKCHAIN_PRIVATE_KEY` as Vercel +
   relevant GitHub Actions secrets. The owner enters the actual key value
   directly via `vercel env add` / `gh secret set` — it must never be pasted into
   an agent conversation or written to a file in the repo.
2. Confirm the exact mint function/ABI to call: the 16 historical transactions
   used a method Polygonscan labels "Mint Product," which must be confirmed
   against `contracts/AuthiChainNFT.sol`'s verified source before assuming it
   matches the `mintCertificateWithSplit` sketch currently in
   `src/lib/blockchain.ts` (which looks like it targets a different, older
   contract — `AuthiChain.sol`, not `AuthiChainNFT.sol`). This is implementation
   groundwork, not yet resolved.
3. Change the anchor path so a failed on-chain call is a **hard error** propagated
   to the caller, not a caught-and-nulled warning. A certificate is either really
   minted or the request fails — no success response with a null tx hash.
4. One real, live test mint against the existing contract, verified on
   Polygonscan (not just a 200 response), before anything is sold.

**Phase 2 — the self-serve flow:**
1. New `PLANS` entry (`certify_single`, $19, `stripe_mode: 'payment'`) — reuses
   the existing `/api/checkout` route and `/api/stripe/webhook` handler already
   used by QRON's real packs, rather than a new payment integration.
2. New page at `/certify`, brand-aware via the existing `resolveBrand()`
   pattern: product name/description/optional image → existing checkout flow.
3. Extend the `checkout.session.completed` case in `/api/stripe/webhook/route.ts`
   to recognize this plan: on confirmed payment, create a `products` row (Drizzle
   schema, matching what `/verify` already reads) and a `qr_codes` row, then call
   the now-fixed real anchoring code to mint on `AuthiChainNFT`. If the mint
   fails, the product record reflects an honest pending/failed state — it is not
   silently marked certified.
4. On success: generate the QR image encoding the real `/verify?id=...&hash=...`
   URL (matching the page's actual expected params — fixing the divergence found
   above), email it to the customer via the existing Resend integration
   (per-brand `emailFrom`), and show it in-browser on the checkout success page.
5. Cross-link from all four domains with brand-specific framing (AuthiChain:
   enterprise anti-counterfeit; StrainChain: batch verification; QRON: "upgrade
   your QR art to a real on-chain certificate"; GovChain: asset/supply
   verification) — one backend, four doors, matching the existing shared-billing
   pattern in `shared/brands.ts`.
6. `/verify/page.tsx` already shows real product/provenance data and links out to
   Polygonscan-style verification — confirm it surfaces the actual Polygon tx
   hash/link prominently, since that live, checkable link *is* the entire trust
   claim this product is selling.

**Deferred phase — real Bitcoin Ordinals anchoring:** once Phase 1+2 are live and
have at least one real paying customer, revisit `server/ordinals-service.ts` to
build real inscription creation (likely via a third-party inscription API rather
than hand-rolling commit/reveal transaction construction) against the owner's
real Taproot address, as a premium add-on tier. Not built now.

## Error handling

- Every on-chain call (mint) either succeeds and returns a real, verifiable tx
  hash, or the caller gets an explicit error — never a 200 with a null/fake hash.
- Stripe webhook processing keeps the existing idempotency pattern already in
  `route.ts` (`stripe_events` claim-before-process) — a retried webhook must not
  double-mint.
- If the Stripe payment succeeds but the on-chain mint fails, the customer has
  paid for something not yet delivered — the product record must show this
  honestly (e.g. a `pending_mint`/`failed_mint` status) so it can be retried or
  refunded, rather than silently disappearing or falsely showing as certified.

## Testing

- Unit tests for the new webhook branch (checkout completed → product/qr_codes
  row created → mint called), using a mocked ethers.js contract call for the
  success and failure paths.
- One real end-to-end test against the live contract on a preview deploy
  (real Stripe test-mode payment, real testnet-or-mainnet mint with a throwaway
  product) before merging to main, verified by checking the resulting tx on
  Polygonscan directly — not by trusting the app's own response.
- Confirm the fixed verify-URL parameter shape end-to-end: scan the QR generated
  by a test purchase and confirm `/verify` actually resolves it.

## Open questions for the implementation plan (not resolved here)

- Exact mint function signature/ABI on the live `AuthiChainNFT` contract.
- Which of `apps/qron-platform/` vs. root `src/` is the actually-deployed tree —
  must be confirmed via deployment inspection before editing either.
- Whether metadata for minted certificates needs to be pinned to IPFS (the
  existing deployment-info shows an `ipfs_cid` for the original contract deploy,
  suggesting a metadata-pinning convention already exists) or can reuse whatever
  pattern the original 16 mints used.
