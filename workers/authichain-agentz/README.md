# authichain-agentz

Cloudflare Containers host for the AgentZ FastAPI (`agentz.api.main:app`).

Public URL: `https://agentz.authichain.com`  
Keep **Cloudflare Access** on `agentz.authichain.com` (same policy family as `claw.authichain.com`).

This host does **not** set `OPENCLAW_GATEWAY_URL`. That stays an owner-set reachable OpenClaw Node. Do not enable social publish from this Worker.

## Image

`workers/authichain-agentz/Dockerfile` follows repo-root `Dockerfile.agentz` (`python:3.12-slim`, `requirements-agentz.txt`, repo-root build context) but is the **API** image: `EXPOSE 8000` and `CMD uvicorn agentz.api.main:app --host 0.0.0.0 --port 8000`.

`Dockerfile.agentz` / `docker-compose.yml` `agentz` stay the CLI (`python3 -m agentz.cli`). Do not change that CMD.

The Container class sets `defaultPort = 8000`.

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
