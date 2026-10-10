# AuthiChain estate map

**Canonical production source:** `undone0603/authichain-unified`.

This repository is the most advanced and authoritative AuthiChain project in the current estate. Production code, new product work, verification semantics, and deployment ownership should converge here. Sibling repositories are historical, specialized, private operational tools, or snapshots; they are not alternate product sources of truth.

## Runtime

```text
scan / generate / pursue
        │
   Cloudflare Workers
   canonical verify + routes
        │
   App surfaces in this repo
   src/ + apps/ + client/
        │
   ┌────┼────────────┐
Supabase   D1       Polygon / Stripe
registry   edge     optional extensions
        │
   AgentZ / MCP
        │
   QRON · GovChain · StrainChain · DPP
```

The canonical trust path is:

`identifier → resolution → signed attestation → canonical verification → evidence-backed decision`

The production verification Worker is `worker-app/`. Its `/api/v1/attestation/verify` response is the source consumed by DPP, QRON, vertical adapters, and AgentZ/MCP.

## Domains

| Host | Job | Canonical app path |
|---|---|---|
| authichain.com | protocol, verification, certificates, billing | `/verify` / `/anchor` / `/dapp` |
| qron.space | QRON generation and experiences | `/generate` |
| govchain.us | contractor/government trust workflows | `/onboard` |
| strainchain.io | provenance and regulated-product workflows | `/onboard` |

Preferred app hosts remain `app.authichain.com`, `app.govchain.us`, and `app.strainchain.io` when their Cloudflare Worker routes are configured. Customer CTAs must use the matching apex path until an app host is actually answering.

Do not use `authichain-unified.vercel.app` as a customer CTA or treat a Vercel project as the production source of truth. Cloudflare is the production edge.

## Keep live / authoritative

- `undone0603/authichain-unified` — **canonical product and production source**
- `undone0603/authichain-ai-business-manager` — private outreach/operations; no product trust boundary
- `undone0603/qron-harvest` — historical/specialized pilot pages; product verification still resolves through the canonical AuthiChain path
- `undone0603/undone0603.github.io` — blog/publishing surface

## Snapshots and superseded projects

- `AuthiChain2026/authichain-mcp-server` — MCP snapshot/reference only; new MCP work belongs in `mcp/` here unless an independently deployed integration is explicitly required.
- Archived/superseded sibling projects such as `qron-platform`, `authichain-com`, `qron-space`, `govchain.us`, `strainchain-io`, `authichain_premium`, and older protocol/OS repositories must not become new production sources.
- The `apps/qron-platform` tree inside this repository is retained as source history/compatibility during consolidation; its README must not be interpreted as a separate production project.

## Cloudflare ownership rule

Every production Worker must have exactly one canonical source, one declared identity, and one authorized deployment path unless explicitly marked external or transitional. See `config/cloudflare-estate.json`.

Do not retire or overwrite `authichain-verify-worker` or `authichain-consensus-engine` solely from repository evidence: both require live Cloudflare identity reconciliation before any retirement/change.

## Production update rule

The production target advances only from a validated repository commit. Required sequence:

`current head → tests/typecheck/lint/security → impact classification → authorization → deploy → smoke test → rollback readiness`

A passing documentation update does not authorize a production deployment, and a deployment does not manufacture a verification claim.

## Maison Élite

`cf-workers` and dropship experiments are a separate company. Keep them off AuthiChain production routing and trust-boundary decisions.
