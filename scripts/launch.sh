#!/usr/bin/env bash
#
# AuthiChain — one-command go-live
#
#   pnpm launch                 # build + deploy CF workers + ping Vercel
#   pnpm launch --dry-run       # show what would happen, do nothing
#
# Hard gates (each is a refusal, not a warning):
#   1. preflight must be 🟢 GO (no DB/Stripe/JWT blockers).
#   2. working tree must be clean and on main (no surprise deploys).
#   3. main must be in sync with origin/main (no stale deploys).
#
# Does NOT:
#   - flip PAYOUTS_ENABLED, REQUIRE_OUTREACH_APPROVAL, or any safety flag.
#   - send outbound email or move funds.
#   - rotate any secret.
#
# After this script: configure the Stripe webhook URL in Stripe Dashboard
# and run a single real test purchase. That transaction is launch.

set -euo pipefail

DRY_RUN=0
SKIP_WORKERS=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=1 ;;
    --skip-workers) SKIP_WORKERS=1 ;;
    -h|--help)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
step() { printf "\n${BOLD}── %s ──${RESET}\n" "$1"; }
ok()   { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${RESET} %s\n" "$1"; }
die()  { printf "  ${RED}✗ %s${RESET}\n" "$1" >&2; exit 1; }
run()  { if [ "$DRY_RUN" -eq 1 ]; then printf "  ${YELLOW}[dry-run]${RESET} %s\n" "$*"; else eval "$@"; fi; }

cd "$(dirname "$0")/.." || die "cannot cd to repo root"

# ── Gate 1: preflight ────────────────────────────────────────────────────────
step "Gate 1 / 3 — preflight"
if ! pnpm preflight; then
  die "preflight is NO-GO. Fix the ❌ lines, then re-run. (See GO_LIVE.md.)"
fi
ok "preflight clean"

# ── Gate 2: clean working tree on main ───────────────────────────────────────
step "Gate 2 / 3 — git state"
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || die "not on main (currently '$branch'). Deploys must come from main."
[ -z "$(git status --porcelain)" ] || die "working tree has uncommitted changes. Commit or stash, then re-run."
ok "on main, working tree clean"

# ── Gate 3: in sync with origin/main ─────────────────────────────────────────
step "Gate 3 / 3 — origin sync"
git fetch origin main --quiet
local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse origin/main)"
if [ "$local_head" != "$remote_head" ]; then
  die "local main is not in sync with origin/main. Run 'git pull origin main' (or fix divergence), then re-run."
fi
ok "main is at $(git rev-parse --short HEAD), matches origin/main"

# ── Build ────────────────────────────────────────────────────────────────────
step "Build"
run "pnpm build"
ok "build succeeded"

# ── Deploy Cloudflare workers ────────────────────────────────────────────────
step "Cloudflare workers"
if [ "$SKIP_WORKERS" -eq 1 ]; then
  warn "skipped (--skip-workers)"
else
  if ! command -v wrangler >/dev/null 2>&1 && ! pnpm exec wrangler --version >/dev/null 2>&1; then
    die "wrangler not available. Install (pnpm add -Dw wrangler) or login first."
  fi
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then ok "CLOUDFLARE_API_TOKEN set"; else warn "CLOUDFLARE_API_TOKEN not set — wrangler will prompt"; fi
  if [ -f package.json ] && grep -q '"deploy:all"' package.json; then
    run "pnpm run deploy:all"
    ok "deploy:all completed"
  else
    warn "no 'deploy:all' script in package.json — skipping. Use scripts/deploy-all.sh or per-worker 'wrangler deploy'."
  fi
fi

# ── Trigger Vercel ───────────────────────────────────────────────────────────
step "Vercel"
if command -v vercel >/dev/null 2>&1; then
  run "vercel --prod --yes"
  ok "Vercel deploy invoked"
else
  warn "vercel CLI not on PATH. If your repo is connected to Vercel via GitHub, pushing to main already triggers a deploy."
  warn "To deploy from CLI: 'pnpm dlx vercel --prod' (after 'vercel link')."
fi

# ── Manual checklist ─────────────────────────────────────────────────────────
step "Now (manual, ~5 min)"
cat <<'EOF'
  □ Stripe Dashboard → Developers → Webhooks
    - Endpoint: https://<your-prod-domain>/api/stripe/webhook
    - Events:  customer.subscription.*  invoice.payment_*
               checkout.session.completed  checkout.session.expired
    - Confirm signing secret matches STRIPE_WEBHOOK_SECRET in prod env.
  □ One real test purchase from a different email; refund yourself after.
  □ Confirm in Stripe → recent webhook deliveries → 200 within seconds.

That single 200 is launch.
EOF
