# AuthiChain estate map

Canonical product code lives in **this repository** (`undone0603/authichain-unified`).
Target public home: `AuthiChain2026/authichain-unified` if/when you want org ownership. **Transfer is optional hygiene, not a launch gate** — `undone0603/authichain-unified` already builds and deploys production. Manual GitHub UI only; connector cannot transfer.

## Runtime

```
scan / generate / pursue
        │
   CF Worker (verify, host route)   workers/* + worker/
        │
   App (Vite/React + legacy Next)   client/  apps/
        │
   ┌────┼────────────┐
Supabase   Polygon    Stripe
registry   NFT+$QRON  cash
        │
MCP  mcp/  and snapshot AuthiChain2026/authichain-mcp-server
        │
BD   undone0603/authichain-ai-business-manager (private, API-only)
```

## Domains (do not use *.vercel.app in customer CTAs)

| Host | Job | App path |
|---|---|---|
| authichain.com | protocol, verify, certs, billing | /verify /anchor /dapp |
| qron.space | generate Living QR | /generate |
| govchain.us | contractor pursue + seals | /onboard |
| strainchain.io | cannabis jar pack | /onboard |

Preferred app hosts: `app.authichain.com`, `app.govchain.us`, `app.strainchain.io`.
Until those CNAMEs exist, CTAs must use the matching apex path (`https://govchain.us/onboard`), never `authichain-unified.vercel.app`.

## Keep live

- `undone0603/authichain-unified` — product
- `undone0603/authichain-ai-business-manager` — private outreach; no product UI
- `undone0603/qron-harvest` — HARVEST pilot pages; certs still resolve on authichain.com
- `undone0603/undone0603.github.io` — blog
- `AuthiChain2026/authichain-mcp-server` — publish snapshot of `mcp/`

## Superseded (do not deploy; archive in GitHub UI)

- undone0603: `authichain-com`, `qron-space`, `govchain.us`, `strainchain-io`, `qron-platform`, `authichain_premium`, `authichain`, `authichain-protocol`, `authichain-archive`
- AuthiChain2026: `AuthiChain`, `qron-app`, `authichain-os`
- Z-kie: `qron`, `qron-platform`, `authichain-landing`, `strainchain`, empty stubs

Already archived: `qron-starter-v2`, `authichain-os` (user), `authichain-unified-revenue-engine`, `Validation-key`, `strainchain-telegram-app`, `nextjs-boilerplate`.

Archived 2026-09-16 (public-loop freeze): undone0603 `authichain-com`, `qron-space`, `govchain.us`, `strainchain-io`, `qron-platform`, `authichain_premium`, `authichain`, `authichain-protocol`, `authichain-archive`, `qron-webapp`.

AuthiChain2026 snapshots still need a dashboard archive (org API 403). Repo homepage set to https://authichain.com. Freeze runbook: `docs/operations/PUBLIC_LOOP_FREEZE.md`.

## Maison Élite

`cf-workers` and dropship experiments are a separate company. Keep off AuthiChain topics.
