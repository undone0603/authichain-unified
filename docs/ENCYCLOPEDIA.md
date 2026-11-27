# AuthiChain + AgentZ Encyclopedia

_Canonical definitions for the authentic agentic economy. Source of truth: this file + `docs/OPERATING_CHARTER.md` + `.github/autonomy.json`. Last compiled 2026-11-27. Never invent customers, revenue, certifications, or results._

**Repo:** `github.com/undone0603/authichain-unified`  
**Public hosts:** authichain.com · qron.space · govchain.us · strainchain.io  
**CTA rule:** customer-facing links use apex paths only (`/onboard`, `/dapp`, `/verify`). Never publish `*.vercel.app` or `*.workers.dev` URLs.

---

## A — Core terms

### AgentZ
Python workflow orchestrator (`agentz/`). CLI entry: `python -m agentz.cli list` / `run <id> --mode dry-run`. Defaults to confirm mode; `--mode auto` is refused for selected workflows and for `--all`. Live side effects require explicit confirmation and credential preflight. GitHub path (`agentz-orchestration.yml`) stays dry-run for the architect cycle. Short CLI: `z` / `agentz` (status, browse, research, run, verify). Identity published at `did:web:authichain.com:agents:agentz`. See `docs/agentz/calling-agentz.md`.

### Authentic Agentic Economy
Positioning: authenticity layer for agents and humans. One primitive, four faces:
```
object → signed seal (Ed25519 + optional Polygon NFT)
      → human scan  /verify          → Stripe entitlement
      → agent call  POST /api/x402   → $0.05 USDC on Base
      → public receipt
```
A seal proves the published record has not been altered since signing. It does **not** certify a lab, government, or that the physical item was never swapped. Catalog freeze status: founder YES 2026-09-24. See `docs/AUTHENTIC_AGENTIC_ECONOMY.md`.

### AuthiChain
Protocol, certificates, API, billing surface on authichain.com. Brands under the same mono-repo: AuthiChain (core), QRON (living QR studio), GovChain (contractor pursue + seals), StrainChain (cannabis jar / COA packs). Shared routes: `/dashboard`, `/login`, `/api`, `/onboard`.

### Autonomy lanes
Defined in `.github/autonomy.json` and enforced by `Autonomy reconcile`:
| Lane    | Role |
|---------|------|
| ship    | Build, test, security, deploy on push |
| health  | Hourly ops-pulse + daily read-only probes |
| revenue | Warm leads → checkout, dunning, gov digest, revenue report |
| growth  | SEO, owned social, listening, gated cold outreach |
| repair  | Classify failed checks → draft fix PRs |
| manual  | Secrets, backfills, one-off sends (owner only) |
| retired | Disabled, kept for history |

Silence = healthy. Human needed → one GitHub issue labelled `ops-alert` or `approval-needed`.

---

## B — Billing & money surface

### Battery Passport / DPP readiness
Public offer: https://authichain.com/battery-passport → $299 one-time. EU Digital Product Passport readiness path. Deadline reference 18 Feb 2027. Not legal advice. Loop 1 in the authentic economy catalog.

### Cold outreach rules
Two keys required for live send: `cold_outreach.enabled: true` in autonomy.json **and** repo variable `OWNER_LIVE_SEND=true`. Cap: `max_new_prospects_per_day` (default 10). Deliverability breaker (bounce >3% or any spam complaint) forces dry-run. Send-guard: verified/opt-in only, CAN-SPAM footer + physical address, recordable opt-out, MX check, history dedupe. Historical: 16% bounce, 0 replies on guessed addresses — provenance gate exists to prevent repeat.

### Credits / generations
Free trial cap: `free.generations = 5` (was unlimited). Signup and webhook provisioners must write `users.generations_limit = 5`. GPT-4 Vision is a paid path.

---

## C — Certificates & verification

### Certificate / Seal
Ed25519-signed record of an object. Optional Polygon ERC-721 NFT. Public verification <2s target. Scan → entitlement or 402 challenge. Does not assert physical chain-of-custody beyond the signed data.

### Cloudflare Workers
Edge runtime for apex sites, API gateway, scan-validate, provenance, autopilot, outreach, image-gen, stripe-webhook, resend-relay. Deploy via `.github/workflows/deploy-cloudflare.yml` + per-worker Wrangler 4 configs. Known drift: some live workers lack repo source — treat as risk until sourced into `workers/`.

### Consensus (historical 5-agent)
Guardian / Sentinel / Archivist / Arbiter / Scout pattern for multi-agent verification. Current primary path is signed seal + GPT-4V product verification on paid routes.

---

## D — Data & deploy

### D1
Cloudflare D1 used for provenance and selected worker state (e.g. `authichain-provenance`).

### Drizzle / Supabase
Postgres + Drizzle ORM for primary app data. Migrations under `drizzle/` / `supabase/`. Production migrations are owner-gated (see Operating Charter).

### Deploy authority
Cloudflare-first baseline. Main-only integration. Smoke + repair loop documented in `docs/operations/CLOUDFLARE_FIRST_BASELINE.md` and `docs/operations/PILOT-READY-BASELINE.md`. Pilot-readiness chain: install → typecheck → lint → tests → production build → deploy smoke → real product scan. Any red link is a blocker.

---

## E–G

### Ed25519
Signing algorithm for seals and AgentZ identity proofs. Possession check via `z verify` / `identity.py`. Operator-binding proof can be published as public gist and independently verified with `cryptography` only.

### Founder independence / exit
Continuity ledger and remaining exit blockers live in `docs/FOUNDER_INDEPENDENCE.md` and `docs/FOUNDER_EXIT_DRILL.md`. Goal: stack runs with zero founder computer on and minimal human time.

### GovChain
govchain.us vertical: contractor pursue + seals for documents, licenses, procurement. Same seal primitive. Not FedRAMP, not SAM.gov certification claim. Gov engine pipelines exist under GitHub Actions (ingest/score/proposals/notify).

### GS1 / DPP
GS1 conformance and resolver notes in `docs/GS1_CONFORMANCE.md` / `docs/GS1_RESOLVER.md`. EU DPP compliance audit is thin; treat regulated claims as flagged for licensed review.

---

## H–M

### HubSpot
Connected portal Authichain `245112265` (NA2). Named-humans CRM discipline: never invent people; never send from HubSpot without founder yes. See `docs/integrations/hubspot.md` and crm-named-humans skill.

### Launch mode
Temporary loosening of named gates until first non-founder revenue, then auto-tighten. Controlled by `launch_mode` in autonomy.json; max window 90 days. Never loosens: send guard, deliverability breaker, prices, secrets, DNS, truth rule.

### MCP
Model Context Protocol server under `mcp/`. Credential-free reproduction paths preferred. Agent verify surface also reachable via MCP tools/call → x402 challenge when unpaid.

### Merge autopilot
Green + clean PRs from trusted authors into main auto-merge (squash) unless restricted path or restricted symbol is touched. Restricted: payment trust, paid fulfilment, outbound-send gating, secrets, deploy workflows, migrations, pricing, autonomy controls themselves. Hold label or `enabled: false` stops it.

---

## N–R

### NETWORK.md / ESTATE.md
Deploy map and estate inventory. Always prefer live numbers from source over hand-typed figures.

### Operating Charter
`docs/OPERATING_CHARTER.md` — highest governance doc after autonomy.json. Defines what agents may do alone vs what always waits for owner. Where older docs disagree, Charter + autonomy.json win.

### Pilot-readiness
Engineering acceptance gate for first real-product pilot. Red link anywhere in the chain blocks ship.

### Polygon
Chain for optional NFT certificates. `$QRON` token exists but is **not** the x402 payment rail.

### QRON
qron.space — AI living QR studio (static / kinetic / holographic modes, StoryMode, Living Portals). Public packs start at $29 / $99. Generate surface is Loop 2 of the authentic economy catalog.

### Revenue model
Self-serve SaaS subscriptions + usage-based API billing. Primary public money URLs (only these as marketed offers):
| URL | SKU | Price |
|-----|-----|-------|
| authichain.com/battery-passport | dpp_readiness | $299 one-time |
| qron.space/generate | starter / creator | $29 / $99 one-time |
| strainchain.io/onboard | strainchain_passport | $49 one-time |
| authichain.com/x402 | agent verify | $0.05 USDC |

Hidden this pass (products may stay live in Stripe but are not public cards): theater tiers, StorePilot Pro, Enterprise public card, twin $10/$1000 DPP prices, $1 proof rails. Live customer MRR is **unknown / $0 claimed**; one $10 founder self-test does not count as customer revenue.

---

## S–Z

### Seal Desk / Four Seals / Sigil / Halo / LUMEN / Quire / Claim Check / SENTRA
Brand / product surface names under the authentic economy umbrella. Treated as skins or modes on the same seal primitive unless a paid seal exists in that category.

### StrainChain
strainchain.io — cannabis vertical, CoA / jar packs, METRC-adjacent positioning. $49 passport offer. Totals recomputed from uploaded panel. Not a METRC replacement. MI MSO pilot outreach is historical; do not invent pilot status.

### Stripe
Account `acct_1SXIyEGqTruSqV8T`. Canonical webhook: `/api/stripe/webhook` (signature-verified, provisions by email + welcome). Retired path `/api/webhooks/stripe` is 404. Provisioning: `checkout.session.completed` → find/create user → record revenue → welcome email. Owner-gated: price changes, new SKUs, refunds, non-checkout Stripe writes.

### x402
Agent micropayment rail. LIVE. `GET /api/x402/health` → 200 ready/trustless. `POST /api/x402` → 402 + asset + EIP-712 when unpaid. $0.05 USDC on Base (8453), Circle USDC, PayTo EOA `0x5db511706FB6317cd23A7655F67450c5AC6e6AA2` (owner-authorized treasury; do not rebind). Facilitator reachable. Catalog at `/api/x402/catalog` and `/.well-known/x402.json`. Public docs: authichain.com/x402. Daily cap $10/payer already set. `$QRON` is not this rail.

### Workers Builds (HUMAN)
Cloudflare Dashboard → Workers & Pages → `authichain` → Settings → Build → Build command = `pnpm exec vite build` → Save. Dashboard step remains required after relevant merges.

---

## Stack snapshot (do not invent drift)

- **Web:** Vite + React (pnpm), TypeScript
- **Edge:** Cloudflare Workers + Wrangler 4, D1
- **Data:** Supabase Postgres + Drizzle
- **Chain:** Polygon NFT certificates, Ed25519 seals
- **AI:** GPT-4 Vision product verification (paid), AgentZ Python orchestrator
- **MCP:** `mcp/`
- **CI/Deploy:** GitHub Actions → Cloudflare; pilot-readiness chain mandatory
- **Money:** Stripe + x402 USDC on Base

Infra cost target: $0 (GitHub public Actions, CF free tier, issues for alerts). Time-to-ship for doc-only changes: minutes. Revenue impact of this encyclopedia: indirect (reduces agent hallucination and founder re-explanation cost).

---

## Guardrails (non-negotiable)

1. Never fabricate customers, revenue, testimonials, certifications, audit results, or regulatory approval.
2. Never publish, post, email, spend, sign, or change permissions without founder explicit go-ahead in chat. Draft and wait.
3. Never print, log, or paste secrets, API keys, private keys, seed phrases, or bank details. Reference secret names only.
4. Multi-tenant safety: every query and route must be tenant-scoped.
5. Cannabis, government, medical, and financial claims need licensed professional review. Flag them; never present as legal advice.
6. Dry-run first. AgentZ: `--mode dry-run` and show the plan before any real run.
7. Customer CTAs: apex paths only.

---

## How to extend this encyclopedia

1. Add a term only when it has a stable definition used by ≥2 agents or docs.
2. Prefer a one-paragraph definition + one canonical link over long prose.
3. If a number is claimed, it must be live-sourced or marked **unknown**.
4. Update the compiled date and open a PR; restricted-path rules apply if autonomy or payment surfaces are touched.
5. Cross-link, do not duplicate, `OPERATING_CHARTER.md`, `AUTHENTIC_AGENTIC_ECONOMY.md`, `CAPABILITIES.md`, `NETWORK.md`.

---

## Quick agent lookup

| Need | Go to |
|------|--------|
| What may run alone | OPERATING_CHARTER.md + autonomy.json |
| Money URLs & loops | AUTHENTIC_AGENTIC_ECONOMY.md |
| What is deployed | NETWORK.md + CAPABILITIES.md |
| How to call AgentZ | docs/agentz/calling-agentz.md |
| Pilot gate | operations/PILOT-READY-BASELINE.md |
| This glossary | docs/ENCYCLOPEDIA.md (this file) |

_End of encyclopedia._
