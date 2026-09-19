# authichain-agentz (Cloudflare Containers)

Hosts the AgentZ FastAPI (`agentz.api.container_app:app`) on **`https://agentz.authichain.com`**.

## Why Containers

The OpenClaw bridge Worker (`claw.authichain.com`) cannot call `localhost`.
This package gives AgentZ a public HTTPS origin so:

```
OPENCLAW Worker  AGENTZ_API_URL=https://agentz.authichain.com
```

## Deploy

Requires **Docker** on the machine running Wrangler (Wrangler builds the image).

```bash
cd workers/authichain-agentz
npm install
npx wrangler deploy
```

### Secrets (Worker → container env)

```bash
npx wrangler secret put AGENT_SECRET                 # Bearer for /agents, /workflows, …
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# optional LLM keys if you expand beyond the lean image
```

### Point OpenClaw bridge at this host

```bash
cd ../authichain-openclaw
npx wrangler secret put AGENTZ_API_URL
# enter: https://agentz.authichain.com
npx wrangler secret put AGENTZ_API_KEY
# enter: same value as AGENT_SECRET
```

## Verify

```bash
curl -sS https://agentz.authichain.com/__worker_health
curl -sS https://agentz.authichain.com/health
curl -sS -H "Authorization: Bearer $AGENT_SECRET" https://agentz.authichain.com/agents
```

Access should stay **on** for `agentz.*` / `claw.*` (see `docs/operations/PUBLIC_LOOP_FREEZE.md`).

## Lean image

`requirements-agentz-api.txt` boots FastAPI + Supabase client only.
Heavy LLM / Playwright stacks live in `requirements-agentz.txt` — install those
on a full host if needed; do not bake them into the first Container image.
