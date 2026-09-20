# Money-path microsites

Targeted first-dollar pages for AuthiChain. Self-serve checkout only. No call booking. Brand AuthiChain; SAM legal entity **ZACHARY KIETZMAN** (no AuthiChain Inc).

## Inventory (2026-09-20)

| Surface | What actually happens |
| --- | --- |
| `workers/authichain-com` | Serves **authichain.com** and **www.authichain.com** (`authichain.com/*`). This is the live apex. Last deploy path: `.github/workflows/deploy-authichain-com.yml`. |
| Root worker `authichain` (`worker/index.ts`, `wrangler.toml`) | Binds **MICROSITES_KV** id `a992900da1db4b998af1cdf4eccf550a`. Routes `*.authichain.com` (except apex/www) to KV key `{subdomain}{path}` with `/` → `/index.html`. **R2 is not used.** |
| `*.authichain.com` today | Wildcard DNS exists (Cloudflare 522/523). No worker is attached. Do **not** enable Workers Paid to fix this. |
| `agentz/core/microsites.py` | Stale R2 + Vercel alias path. Do not use. |
| `/p` and `/p/<serial>` | Product passport GET on `APP_WORKER`. **Do not** put campaign pages here. |

Live money rails (probed 2026-09-20):

- Passport $49 → `GET https://authichain.com/api/checkout/plan/strainchain_passport` → **303** Stripe
- DPP $299 → `GET https://authichain.com/api/checkout/dpp` → **303** Stripe

## Live URLs (apex — no new DNS)

After `authichain-com` deploys from main:

| Pack | Canonical | Aliases |
| --- | --- | --- |
| Mendo / RealTHCV / LT-63 | https://authichain.com/m/mendo | `/m/realthcv`, `/m/lt-63` |
| TruMark | https://authichain.com/m/trumark | — |
| Made in America | https://authichain.com/m/musa | `/m/made-in-america` |
| StrainChain hub | https://authichain.com/m/strainchain | — |
| Index | https://authichain.com/m | — |

Existing product briefs stay at `/trumark`, `/made-in-america`, `/genetics/mendo-love-farms`, `/passport`.

Host-based copies (`mendo.authichain.com`) are coded in `tryHandleMicrosite` but **not** added as wrangler routes in this PR — extra custom hostnames can fail a free-plan deploy, and `*.authichain.com` already 522/523. Attach a host route later only if a human confirms the zone accepts it. `/m/...` does not need that.

## KV keys (optional, root worker)

Namespace **MICROSITES_KV** `a992900da1db4b998af1cdf4eccf550a` (title confirmed via Cloudflare bindings). Upload:

```bash
# requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
./scripts/upload-microsites-kv.sh
```

| Key | File |
| --- | --- |
| `mendo/index.html` | `content/microsites/mendo/index.html` |
| `realthcv/index.html` | same as mendo |
| `trumark/index.html` | `content/microsites/trumark/index.html` |
| `musa/index.html` | `content/microsites/musa/index.html` |
| `made-in-america/index.html` | same as musa |
| `strainchain/index.html` | `content/microsites/strainchain/index.html` |

KV does nothing useful until a worker route is attached to those hostnames. Prefer `/m/`.

## Edit / deploy

1. Edit `content/microsites/<slug>/index.html`.
2. `node scripts/sync-microsite-packs.mjs` (embeds HTML into `workers/authichain-com/src/microsite-packs.ts`).
3. `pnpm --dir workers/authichain-com test` (or the tsx tests listed in that package.json).
4. Merge to main → `Deploy authichain-com` publishes `/m/...`.

Do not invent Stripe prices. Do not add “book a call”.

## IndexNow + ghost targets

Machine list: `content/microsites/targets.json`.

Wired into:

- `.github/workflows/marketing-autonomous.yml` (IndexNow ping list)
- `agentz/workflows/handlers/ghost_traffic_engine.py` (`MONEY_PATHS` + Passport checkout 303)

After merge, optional: `gh workflow run marketing-autonomous.yml -R undone0603/authichain-unified -f strategy=seo_only -f dry_run=true` then a live `seo_only` once the apex pages 200.
