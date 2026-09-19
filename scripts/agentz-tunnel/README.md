# AgentZ via free Cloudflare Tunnel ($0)

Owner mandate 2026-09-19: stay on **$0** until revenue. Host AgentZ with a
**named free Cloudflare Tunnel**. Do **not** enable Workers Paid. Do **not**
deploy Cloudflare Containers (`authichain-agentz`).

Named tunnel UUID (already created):

`08378b03-f6a2-46cf-aab8-a2754bad869f`

Hostname: `agentz.authichain.com` →
`08378b03-f6a2-46cf-aab8-a2754bad869f.cfargotunnel.com` (proxied CNAME).

Full setup: `docs/integrations/openclaw-setup.md` § AgentZ via free Cloudflare
Tunnel. Routing note: `docs/ROUTING.md`. Orchestration dry-run enablement is
`docs/operations/AGENTZ_ORCHESTRATION.md`. This is not social publish.

Do not invent `OPENCLAW_GATEWAY_URL`. That stays an owner-set reachable
OpenClaw Node.

## After merge: Actions configures Cloudflare

**Actions → AgentZ tunnel bring-up ($0) → Run workflow.**

Uses existing repo secrets only (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `AGENT_SECRET`, `SUPABASE_*` if present). Do not
paste secrets into chat.

That dispatch:

1. Binds claw-only secrets on `authichain-openclaw`:
   `AGENTZ_API_URL=https://agentz.authichain.com` and
   `AGENTZ_API_KEY` from `secrets.AGENT_SECRET`. Skips `authichain-agentz`
   Containers secrets unless they already work. Does **not** set
   `OPENCLAW_GATEWAY_URL`. If `AGENT_SECRET` is empty, claw bind fails
   unless `DEV_TEAM_GITHUB_TOKEN` / `GH_PAT` can mint once and
   `gh secret set AGENT_SECRET` (1-day artifact for local uvicorn — the
   Actions UI cannot show secret values). DNS + route cleanup still run
   without `AGENT_SECRET`. **Owner must set repo secret `AGENT_SECRET`**
   (or allow that mint) before claw will answer AgentZ.
2. `GET`s tunnel `08378b03-f6a2-46cf-aab8-a2754bad869f`.
3. Ensures the proxied CNAME above.
4. Deletes Worker route `agentz.authichain.com/*` on `authichain-agentz`
   (and a Worker custom domain on that hostname if one exists).
5. Mints a `cloudflared tunnel run --token` credential via the Cloudflare
   API. Optionally uploads a **1-day** artifact. If `DEV_TEAM_GITHUB_TOKEN`
   or `GH_PAT` exists, stores repo secret `AGENTZ_TUNNEL_TOKEN`. Actions
   **does not** keep a connector running (ephemeral runners).

`Set agentz/claw secrets` is the claw-only bind without the DNS work.

## Owner box: run the connector

Actions cannot hand a live token to your machine. Prefer minting locally
with the same Cloudflare API token Actions uses (no `cloudflared login`
cert):

```bash
export CLOUDFLARE_API_TOKEN=...    # repo Actions secret; do not paste into chat
export CLOUDFLARE_ACCOUNT_ID=...

cd /path/to/authichain-unified
PYTHONPATH=. python -m uvicorn agentz.api.main:app --host 127.0.0.1 --port 8000

# GET tunnel token + exec: cloudflared tunnel run --token <token>
# (token is not printed)
./scripts/agentz-tunnel/run-with-api-token.sh
```

If you downloaded the 1-day Actions artifact instead:

```bash
cloudflared tunnel run --token "$(cat agentz-tunnel-token.txt)"
```

Local uvicorn env (not Worker secrets): `AGENT_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` — the names `agentz.core.credentials.get()`
reads.

## Named tunnel + local config.yml (cert path)

Only if you already have `~/.cloudflared/*.json` from `cloudflared tunnel
login`. Prefer the API-token path above.

```bash
# Already created — do not create a second tunnel.
# UUID: 08378b03-f6a2-46cf-aab8-a2754bad869f
cp scripts/agentz-tunnel/config.example.yml scripts/agentz-tunnel/config.yml
# set credentials-file to ~/.cloudflared/08378b03-f6a2-46cf-aab8-a2754bad869f.json

cloudflared tunnel --config scripts/agentz-tunnel/config.yml run
```

### Worker route conflict

When Tunnel DNS owns `agentz.authichain.com`, a Worker route on the same
hostname fights the tunnel (522). The bring-up workflow deletes
`agentz.authichain.com/*` on `authichain-agentz`. Leave that worker
**undeployed** (`deploy-workers.yml` gates it behind
`deploy_agentz_containers`, default off).

Do not attach both a Worker route and the tunnel CNAME.

## Quick tunnel (smoke only)

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

Prints a `*.trycloudflare.com` URL. It **changes** every restart. **No SSE
guarantee.** Smoke only — do not point claw at it.

## Claw secrets

Handled by the bring-up workflow or **Set agentz/claw secrets**. Manual
equivalent:

```bash
cd workers/authichain-openclaw
npx wrangler secret put AGENTZ_API_URL
# Enter: https://agentz.authichain.com
npx wrangler secret put AGENTZ_API_KEY
# Enter the same value as local AGENT_SECRET (GitHub secret AGENT_SECRET)
```

`OPENCLAW_GATEWAY_URL` is owner-set only. Do not invent a URL. Do not enable
social publish from this bridge.
