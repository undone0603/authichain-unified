# Cloudflare Access contract

Probed 2026-09-16 07:54 EDT. Access lift confirmed 2026-09-17 (~21:44 UTC): apexes return 200, not Access 302.
Remaining protocol gap: `/.well-known/jwks.json` must be `application/json`, not landing HTML.

All four apexes currently 302 to:

`https://strainchainexecutiveteam.cloudflareaccess.com/cdn-cgi/access/login/<host>`

That includes `/`, `/verify`, `/onboard` on authichain.com, qron.space, govchain.us, strainchain.io.

Access runs **before** Workers. No wrangler change, CTA fix, or monorepo transfer unblocks a phone scan while this policy is on the apex.

## Target

Zero Trust team: `strainchainexecutiveteam`.

### Delete or disable

Any Access application whose domain is the bare hostname:

- `authichain.com`
- `www.authichain.com`
- `qron.space`
- `www.qron.space`
- `govchain.us`
- `www.govchain.us`
- `strainchain.io`
- `www.strainchain.io`

Do not replace them with a “bypass for everyone” app on `*`. Delete the app so the zone is public.

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
| `https://authichain.com/.well-known/jwks.json` | JWKS JSON |
| `https://govchain.us/onboard` | onboard form |
| `https://strainchain.io/onboard` | onboard form |
| `https://qron.space/` | studio landing |

Probe after the change:

```
curl -sI https://authichain.com/verify | head
```

Pass = HTTP 200 or app 404. Fail = `location: …cloudflareaccess.com…`.

## Dashboard path (4 minutes)

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → team `strainchainexecutiveteam`
2. Access → Applications
3. Sort by domain. Anything whose domain is an apex above → Disable, then Delete
4. Confirm Applications list only dashboard / claw / admin
5. Incognito: open `https://authichain.com/verify`

Do not add a new Access app “to be safe” on `*.authichain.com`. That re-locks verify.
