# MIGRATION_PLAN

## Goal
Restructure `authichain-unified` into a cleaner monorepo with clearer deployment boundaries, stronger CI, per-domain Workers, and host-based tenant routing.

## 0) Assumptions
- Repo root is the current working tree.
- Package manager is `pnpm`.
- Next.js app stays in the repo.
- Cloudflare Workers are the primary edge deployment target.
- Existing docs/scripts are being reorganized, not deleted.

## 1) Create target folders
```bash
mkdir -p docs/{architecture,grants,investor,ops,proposals,research,security,strategy}
mkdir -p archive/{debug,env,lint}
mkdir -p scripts/{automation,checks,deploy,fixes,migrations,seed,testing,verify}
mkdir -p workers/{authichain,qron,strainchain,govchain,shared}
mkdir -p contracts/{audits,scripts}
mkdir -p src/app/(tenants)/{auth,qron,strain,gov}
```

## 2) Move docs
```bash
mv DHS_SVIP_Grant_Application.md docs/grants/dhs/
mv NSF_SBIR_Project_Pitch.md docs/grants/nsf/
mv polygon_grant_draft.md docs/grants/polygon/
mv MI_CRA_Partnership_Proposal.md docs/proposals/mi-cra/
mv NY_OCM_Partnership_Proposal.md docs/proposals/ny-ocm/
mv OH_DCC_Partnership_Proposal.md docs/proposals/oh-dcc/
mv POSTAL_STRATEGY.md docs/strategy/postal/
mv REVENUE_STRATEGY.md docs/strategy/revenue/
mv SERIES_A_BOARDROOM_BRIEFING.md docs/investor/
mv TECHNICAL_COMPETITIVE_SUPERIORITY.md docs/architecture/
mv SIGNATURE_MANIFEST.md docs/architecture/
mv AUTHENTICITY_INDEX.md docs/architecture/
mv SYSTEM_STATE.md docs/ops/
mv LAUNCH_CHECKLIST.md docs/ops/
mv SIGNWELL_MIGRATION.md docs/ops/
mv todo.md docs/ops/
mv research-findings.md docs/research/
mv SECURITY.md docs/security/
```

## 3) Archive generated artifacts
```bash
mv eslint_errors.txt archive/lint/
mv all_used_envs.txt archive/env/
mv clean_envs.txt archive/env/
mv PATCH_EOF archive/debug/
```

## 4) Move scripts
```bash
mv check-*.js scripts/checks/ 2>/dev/null || true
mv verify-*.js scripts/verify/ 2>/dev/null || true
mv seed-*.js scripts/seed/ 2>/dev/null || true
mv seed-*.ts scripts/seed/ 2>/dev/null || true
mv *-migration.js scripts/migrations/ 2>/dev/null || true
mv activate-economy.js scripts/automation/
mv launch-nmip-campaign.js scripts/automation/
mv genesis-launch.js scripts/automation/
mv stress-test-stimulus.js scripts/testing/
mv update-schema.js scripts/migrations/
mv patch-schema.js scripts/migrations/
mv manual-migration.js scripts/migrations/
mv industrial-migration.js scripts/migrations/
mv fix-runtime.js scripts/fixes/
mv fix_regex.py scripts/fixes/
mv setup-vercel-env.sh scripts/deploy/
mv setup_cron.ps1 scripts/deploy/
mv cf-pages-build.sh scripts/deploy/
mv create-auth-user.js scripts/checks/
mv find-user.js scripts/checks/
mv find-any-user.js scripts/checks/
mv check-auth-users.js scripts/checks/
mv check-constraints.js scripts/checks/
mv check-db.js scripts/checks/
mv check-flow-types.js scripts/checks/
mv check-qron-fk.js scripts/checks/
mv check-status-check.js scripts/checks/
```

## 5) Normalize worker layout
```bash
mv worker/* workers/authichain/ 2>/dev/null || true
mv workers/* workers/shared/ 2>/dev/null || true
```

Then split domain-specific code into:
```text
workers/authichain/
workers/qron/
workers/strainchain/
workers/govchain/
workers/shared/
```

## 6) Add workflow files
```bash
mkdir -p .github/workflows
cp deploy-cloudflare.yml .github/workflows/deploy-cloudflare.yml
```

Create these new workflow files:
```text
.github/workflows/ci.yml
.github/workflows/lint.yml
.github/workflows/test.yml
.github/workflows/deploy-vercel.yml
.github/workflows/deploy-cloudflare.yml
.github/workflows/security.yml
.github/workflows/migrations.yml
```

## 7) Update package scripts
Edit `package.json` and make sure these scripts exist or are aligned:
```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "next build",
    "dev": "next dev",
    "cf:types": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",
    "cf:build": "opennextjs-cloudflare build",
    "cf:preview": "pnpm cf:build && opennextjs-cloudflare preview",
    "cf:deploy": "pnpm cf:build && opennextjs-cloudflare deploy",
    "cf:upload": "pnpm cf:build && opennextjs-cloudflare upload"
  }
}
```

## 8) Add tenant middleware
### File path
- If app uses root middleware, keep `middleware.ts`
- If app uses `src/`, move to `src/middleware.ts`

### Starter command to replace file
```bash
cat > middleware.ts <<'EOF'
import { NextRequest, NextResponse } from 'next/server'

const STATIC_PREFIXES = ['/api', '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml']

function getTenant(hostname: string) {
  const host = hostname.toLowerCase()
  if (host.startsWith('auth.')) return { tenant: 'auth', rewrite: '/auth' }
  if (host.startsWith('qron.')) return { tenant: 'qron', rewrite: '/qron' }
  if (host.startsWith('strain.')) return { tenant: 'strain', rewrite: '/strain' }
  if (host.startsWith('gov.')) return { tenant: 'gov', rewrite: '/gov' }
  return null
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const host = req.headers.get('host') || ''
  const tenant = getTenant(host)
  if (!tenant) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = `${tenant.rewrite}${pathname === '/' ? '' : pathname}`
  const res = NextResponse.rewrite(url)
  res.headers.set('x-tenant-id', tenant.tenant)
  res.headers.set('x-tenant-host', host)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
EOF
```

## 9) Add Cloudflare/OpenNext config
### Files to create or update
- `open-next.config.ts`
- `wrangler.toml` or `wrangler.jsonc`
- `cloudflare-env.d.ts`
- `public/_headers`
- `public/_redirects` if needed

### Example `wrangler.jsonc`
```json
{
  "name": "authichain-unified",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-06-03",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets"
  }
}
```

## 10) Add per-worker configs
Create one config per domain worker:
```text
workers/authichain/wrangler.jsonc
workers/qron/wrangler.jsonc
workers/strainchain/wrangler.jsonc
workers/govchain/wrangler.jsonc
```

### Example worker config
```json
{
  "name": "authichain-auth",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-03",
  "compatibility_flags": ["nodejs_compat"]
}
```

## 11) Add CI guardrails
### `security.yml`
- gitleaks scan
- dependency audit
- secret detection on PRs

### `ci.yml`
- install
- lint
- typecheck
- test
- build

### `migrations.yml`
- run drizzle/supabase checks
- fail on schema mismatch

## 12) Update `.gitignore`
Add:
```gitignore
.open-next/
.vercel/
coverage/
archive/
*.log
```

## 13) Optional cleanup
```bash
rm -rf .github-staging  # only after confirming it is redundant
```

## 14) Verification steps
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm cf:types
```

## 15) Recommended commit sequence
```bash
git checkout -b chore/repo-migration

git add docs archive scripts
 git commit -m "chore: reorganize docs and scripts"

git add .github/workflows package.json middleware.ts wrangler.toml wrangler.jsonc open-next.config.ts
 git commit -m "feat: add ci and cloudflare deployment hardening"

git add workers src/app middleware.ts
 git commit -m "feat: consolidate workers and add tenant middleware"
```
