# AgentZ via free Cloudflare Tunnel ($0)

Owner mandate 2026-09-19: stay on **$0** until revenue. Host AgentZ with a
**named free Cloudflare Tunnel**. Do **not** enable Workers Paid. Do **not**
deploy Cloudflare Containers (`authichain-agentz`).

Full setup: `docs/integrations/openclaw-setup.md` § AgentZ via free Cloudflare
Tunnel. Routing note: `docs/ROUTING.md`. This is not a thaw of
`agentz-orchestration` and not social publish.

Do not invent `OPENCLAW_GATEWAY_URL`. That stays an owner-set reachable
OpenClaw Node.

## Named free tunnel (prefer)

```bash
# One-time
cloudflared tunnel login
cloudflared tunnel create agentz
cloudflared tunnel route dns agentz agentz.authichain.com
# OR route a free subdomain you already own:
# cloudflared tunnel route dns agentz <free-subdomain-you-own>
```

Copy `config.example.yml` to `config.yml` (gitignored). Set `tunnel` and
`credentials-file` to the UUID `create` printed. Ingress is
`agentz.authichain.com` → `http://127.0.0.1:8000`.

```bash
cd /path/to/authichain-unified
PYTHONPATH=. python -m uvicorn agentz.api.main:app --host 127.0.0.1 --port 8000

cloudflared tunnel --config scripts/agentz-tunnel/config.yml run
```

### Worker route conflict

When Tunnel DNS owns `agentz.authichain.com`, a Worker route on the same
hostname fights the tunnel.

- Delete the `agentz.authichain.com/*` route on `authichain-agentz`, **or**
- Leave `authichain-agentz` **undeployed**.

Do not attach both.

## Quick tunnel (smoke only)

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

Prints a `*.trycloudflare.com` URL. It **changes** every restart. **No SSE
guarantee.** Smoke only — do not point claw at it.

## Then set claw secrets

```bash
cd workers/authichain-openclaw
npx wrangler secret put AGENTZ_API_URL
# Enter: https://agentz.authichain.com
# (or the free subdomain you routed; not a trycloudflare.com smoke URL)
npx wrangler secret put AGENTZ_API_KEY
# Enter the same value as local AGENT_SECRET
```

`OPENCLAW_GATEWAY_URL` is owner-set only. Do not invent a URL. Do not enable
social publish from this bridge.
