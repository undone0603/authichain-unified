# Public-loop freeze — 2026-09-16 (reconfirmed 2026-09-17 08:33 EDT)

Autonomous scale is paused until a stranger can finish one path without a login code.

## Why

- `authichain.com`, `qron.space`, `govchain.us`, `strainchain.io` wrap every request in Cloudflare Access (`strainchainexecutiveteam.cloudflareaccess.com`, app name "All Workers", kid `53cc38df…`).
- Reconfirmed 2026-09-17: `curl -sI https://authichain.com/` → **302** `location: https://strainchainexecutiveteam.cloudflareaccess.com/cdn-cgi/access/login/authichain.com?...` `cf-ray` IAD. `www-authenticate: Cloudflare-Access`.
- GitHub Actions `Unblock public Access` ran with `apply=true` and deleted **0** apps. Token sees 5 zones but `GET /accounts/{id}/access/apps` is empty and zone Access is **403**. Needs Access: Apps Read+Edit on the team that owns `strainchainexecutiveteam`.
- Until `/verify` is 200 without Access, marketing crons, Copilot CI loops, and content-bundle PRs are noise.
- Base ops EOA is funded (0.002 ETH, nonce 0) but `gov-mint.yml` has **zero runs**. Do not dispatch mint until Access is lifted **and** `GOVCHAIN_NFT_CONTRACT` has bytecode on 8453.

## Live workstream (only)

Issue #878 — traffic → checkout → provision → activate → retain.
Closest product: Nightstamp / Telegram sell + scan gate (`nightstamp-scan-gate.yml`, revenue-cycle).

Judge progress on:

1. Unauthenticated `GET https://authichain.com/verify` (no `cloudflareaccess.com` redirect)
2. One paid certificate issued
3. One `/onboard` that is not Access and not 404
4. One signed Base deploy from ops EOA (see `base-chain-integration.md`)

## Frozen (Actions disabled 2026-09-16)

AgentZ, automerge-dependabot, B2B outreach, browser-vision, content-publish, content-routine-pr, email-proposals, gen-seo-pages, ghost-traffic, gov-engine/ingest/mint/notify/proposals/score, guardrail-digest, marketing-autonomous, pipeline-tick, reddit-monitor, repo-maintenance, seo-regression, social-credentials-check, weekly-video, verify-scheduled-jobs, verify-integrations, verify-outreach-secrets, schema-drift.

Still on: CI, lint, main, CodeQL, security-scan, compliance-audit, deploy-cloudflare / deploy-workers / deploy-edge-worker, nightstamp-scan-gate, revenue-cycle, production-drizzle-audit, unblock-public-access, outreach/DPP **manual** triggers.

Re-enable a workflow only after `/verify` is public: `gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/<id>/enable`.

## Access lift (must be dashboard — token 403)

Zero Trust team: **strainchainexecutiveteam** (login host `strainchainexecutiveteam.cloudflareaccess.com`).

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. Open **All Workers** (and any app whose domain is `authichain.com`, `qron.space`, `govchain.us`, `strainchain.io`, `*.workers.dev`)
3. Delete those apps, **or** set include policy to Bypass / public
4. Keep Access on `dashboard.*`, `admin.*`, `/admin`, claw/openclaw only
5. Confirm: `curl -sI https://authichain.com/verify` is **not** 302 to `cloudflareaccess.com`
6. Then grant the GitHub `CLOUDFLARE_API_TOKEN` `Access: Apps` Read+Edit so `unblock-public-access.yml` can enforce this

Zones the token *can* see (account `Undone.k@gmail.com's Account`):

| Zone | id |
|---|---|
| authichain.com | 6580df4e35d347c94fef88b33784a514 |
| govchain.us | e011a098212bea70c8c05d52277e388c |
| qron.space | 40768f8e504b51cab01e48f636fc73b5 |
| strainchain.io | 9bfee753ef15d3b57621d31bae912895 |
| strainchain.org | 023c1b55b4accdc3652c2f0b9515640e |

## Estate (done vs blocked)

Archived under `undone0603`: authichain-com, qron-space, govchain.us, strainchain-io, qron-platform, authichain_premium, authichain, authichain-protocol, authichain-archive, qron-webapp.

Still need GitHub UI (org token 403, transfer API not available):

- Archive AuthiChain2026/{AuthiChain, qron-app, qron.space, qron-starter-v2-1, authichain-os, authichain-os-1, express, qron-webapp, stable-diffusion-webui, qron-app-fresh}
- Transfer this repo to `AuthiChain2026/authichain-unified`
- Disconnect Cloudflare Workers Builds for `passport-demo` (and `qron-ai-api` if still failing) so they stop red-checking every PR (#952)

Keep live: this repo, `authichain-ai-business-manager`, `qron-harvest`, `undone0603.github.io`, `AuthiChain2026/authichain-mcp-server`.
