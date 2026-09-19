# authichain-agentz

Cloudflare Containers host for the AgentZ FastAPI (`agentz.api.main:app`).

Public URL: `https://agentz.authichain.com`  
Keep **Cloudflare Access** on `agentz.authichain.com` (same policy family as `claw.authichain.com`).

This host does **not** set `OPENCLAW_GATEWAY_URL`. That stays an owner-set reachable OpenClaw Node. Do not enable social publish from this Worker.

## Image

Builds the existing repo-root `Dockerfile.agentz` (same as `docker-compose.yml` `agentz` / `agentz-api`). Context is the monorepo root. The Dockerfile default CMD is `python3 -m agentz.cli`; this Worker overrides `entrypoint` to uvicorn on port 8000.

Local API stand-in:

```bash
docker compose --profile api up agentz-api
# curl http://localhost:8000/health
```

## Deploy

```bash
cd workers/authichain-agentz
npx wrangler secret put AGENT_SECRET
npx wrangler secret put SUPABASE_URL
# credentials.get("supabase_service_key") reads SUPABASE_SERVICE_ROLE_KEY.
# SUPABASE_SERVICE_KEY is accepted as an alias and forwarded to that name.
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# optional alias:
# npx wrangler secret put SUPABASE_SERVICE_KEY

npx wrangler deploy --config wrangler.jsonc
```

CI: **Actions → Deploy Workers → Run workflow** with `worker=authichain-agentz`.  
Requires Docker on the runner (Containers image build) plus `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. The token needs Workers Scripts edit **and** Containers / registry push.

## After deploy

First request can take a minute while the container boots. Access stays on — unauthenticated curl 302s to `strainchainexecutiveteam.cloudflareaccess.com`. That is correct.

```bash
# After Access login or with a service token:
curl -sS https://agentz.authichain.com/health
# expect: {"status":"sovereign","network":"Polygon"}
```

Claw Worker (`authichain-openclaw`) should use:

```
AGENTZ_API_URL=https://agentz.authichain.com
AGENTZ_API_KEY=<same value as AGENT_SECRET>
```

AgentZ paths have **no** `/api` prefix: `/agents`, `/workflows`, `/architect/cycle`.
