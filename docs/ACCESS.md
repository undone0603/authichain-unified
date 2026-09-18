# Cloudflare Access contract

Status 2026-09-17: apex Access is **lifted**. `authichain.com`, `qron.space`, `govchain.us`, and `strainchain.io` return 200, not a 302 to `strainchainexecutiveteam.cloudflareaccess.com`.

Remaining protocol gap: `https://authichain.com/.well-known/jwks.json` must be `application/json` (public Ed25519 JWK set), not landing HTML. That is a Worker routing + secret bind, not an Access problem.

Historical note: on 2026-09-16 those apexes 302ed to
`https://strainchainexecutiveteam.cloudflareaccess.com/cdn-cgi/access/login/<host>`.
Access runs **before** Workers. If that 302 returns, stop and fix Access first.

## Target

Zero Trust team: `strainchainexecutiveteam`.

### Keep deleted on apexes

Do not recreate Access apps on:

- `authichain.com` / `www.authichain.com`
- `qron.space` / `www.qron.space`
- `govchain.us` / `www.govchain.us`
- `strainchain.io` / `www.strainchain.io`

Do not add a “bypass for everyone” app on `*`. Leave the zone public.

### Keep Access on

| Host / path | App name suggestion |
|---|---|
| `dashboard.authichain.com` | ac-dashboard |
| `claw.authichain.com` | ac-claw |
| `authichain.com/admin*` | ac-admin |
| `authichain.com/dapp*` | ac-dapp (optional) |
| Worker `*.workers.dev` ops scripts | existing |

Policy on those: email allowlist (founder + operators). Not “everyone”.

### Public must answer 200

| URL | Expect |
|---|---|
| `https://authichain.com/` | landing HTML |
| `https://authichain.com/verify` | verify UI or 404 from app, **not** 302 to Access |
| `https://authichain.com/.well-known/jwks.json` | `application/json` JWKS |
| `https://govchain.us/onboard` | onboard form |
| `https://strainchain.io/onboard` | onboard form |
| `https://qron.space/` | studio landing |

```
curl -sI https://authichain.com/verify
curl -sI https://authichain.com/.well-known/jwks.json
```

Access fail = `location: …cloudflareaccess.com…`.
JWKS pass = `content-type: application/json` (or 503 `attestation key unavailable` if the route is live and the secret is not bound).

## Dashboard path (only if Access 302s return)

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → team `strainchainexecutiveteam`
2. Access → Applications
3. Sort by domain. Anything whose domain is an apex above → Disable, then Delete
4. Confirm Applications list only dashboard / claw / admin
5. Incognito: open `https://authichain.com/verify`

Do not add a new Access app “to be safe” on `*.authichain.com`. That re-locks verify.
