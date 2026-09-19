# Cloudflare routing contract

Last updated 2026-09-16. Complements `docs/NETWORK.md`, `docs/ESTATE.md`, and `docs/ACCESS.md`.

**First:** if `curl -sI https://authichain.com/` 302s to `strainchainexecutiveteam.cloudflareaccess.com`, stop. Workers never see the request. Fix Access per `docs/ACCESS.md`.

## Rule

Landing workers own **marketing HTML**. They must not own product paths.
`zone/*` without a live `APP_WORKER` / `APP_ORIGIN` binding swallows `/onboard`, `/verify`, `/dapp`, `/api`.

Never send customers to `*.vercel.app`.

## Intended globs

### authichain.com
| Pattern | Worker |
|---|---|
| `/` (landing assets only) | `authichain-com` |
| `/.well-known/jwks.json` | `authichain-edge-router` via landing `APP_WORKER` proxy |
| `/verify*`, `/onboard*`, `/anchor*` | `authichain-edge-router` (or service-bind from landing) |
| `/api/qron-register*` | `authichain-qron-provenance` |
| `/api/*` (rest) | `authichain-api-gateway` |
| `api.authichain.com/*` | `authichain-api-gateway` |
| `dashboard.authichain.com/*` | `authichain-dashboard` |
| `claw.authichain.com/*` | `authichain-openclaw` |
| `agentz.authichain.com/*` | `authichain-agentz` (Containers → AgentZ FastAPI :8000) |

`/dapp` 302s to `/dashboard` on the landing worker. `/dashboard`, `/dapp`, `/generate`, `/onboard`, `/verify`, and `/api/*` must reach `APP_WORKER` (`authichain-edge-router`). `/dapp*` may stay behind Access. `/verify*` and `/onboard*` must not.

Until `authichain-edge-router` is confirmed deployed (`CLOUDFLARE_DEPLOY_ENABLED`), do **not** cut `authichain.com/*` to a landing worker that cannot proxy. Prefer specific globs.

### app.* hosts (owner DNS)

`app.authichain.com` 522s when the hostname is orange-clouded to a dead origin (retired Vercel). In-repo, `worker-app/wrangler.toml` now registers `app.authichain.com/*` on `authichain-edge-router`. After merge + `deploy-cloudflare.yml`:

1. Cloudflare → authichain.com zone → DNS → `app` CNAME to the zone apex or `100::` (Workers-only) **or** leave the existing record
2. Proxy status: **orange cloud** (proxied)
3. Workers → `authichain-edge-router` → Routes must include `app.authichain.com/*`
4. Do **not** point `app` at `*.vercel.app`
5. Confirm: `curl -sI https://app.authichain.com/dashboard` is not 522

`app.govchain.us` and `app.strainchain.io` are not registered in-repo (those zones have no Worker route yet). Owner steps: add a CNAME `app` on each zone, orange-cloud it, then add `[[routes]] pattern = "app.<zone>/*"` to the matching landing worker (or to `authichain-edge-router` if the zone is attached). Until then, CTAs stay on the apex paths (`/onboard`, `/generate`).

### qron.space
| Pattern | Worker |
|---|---|
| `/` | `qron-space` |
| `/generate*` | app / edge router |
| `/api/*` | rewrite to `api.authichain.com` |

### govchain.us
| Pattern | Worker |
|---|---|
| `/` | `govchain-us` |
| `/onboard*` | app |

CTAs: `https://govchain.us/onboard` only.

### strainchain.io
| Pattern | Worker |
|---|---|
| `/` | `strainchain-io` |
| `/onboard*`, `/genetics*`, `/passport*` | `APP_ORIGIN=https://authichain.com` |

## Root `worker/` (`wrangler.toml` name = authichain)

Has **no `[[routes]]`**. Treat as library/stub until a hostname is attached. Do not run fake `POST /api/register` hashes in production.

## Probe

```
curl -sI https://authichain.com/verify
curl -sI https://authichain.com/.well-known/jwks.json
curl -sI https://govchain.us/onboard
curl -sI https://strainchain.io/onboard
```

Fail = `location: …cloudflareaccess.com…`.
Pass = 200 (or app 404). Then read `cf-worker` for which script answered.
