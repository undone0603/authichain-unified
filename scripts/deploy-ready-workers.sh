#!/usr/bin/env bash
#
# deploy-ready-workers.sh — deploy the 5 launch-ready Cloudflare Workers.
#
# These workers are code-complete but were never deployed (see
# docs/superpowers/plans/worker-status-2026-04-27.md):
#   authichain-autopilot        — 6h cron drip/outreach engine
#   authichain-chain-data       — Polygon $QRON + NFT stats endpoint
#   authichain-license-issuer   — Stripe-webhook → signed software licenses (D1 + KV)
#   authichain-qron-provenance  — pre-mint provenance registry (D1, custom domain)
#   authichain-scan-validate    — QR-decode scan validation (D1, custom domain)
#
# PREREQUISITES (one-time)
#   export CLOUDFLARE_API_TOKEN=...     # perms: Workers Scripts:Edit, D1:Edit, KV:Edit, Workers Routes:Edit
#   export CLOUDFLARE_ACCOUNT_ID=...    # optional; defaults below
#   The D1-backed workers expect their databases to exist. For first-time
#   setup of license-issuer run: bash workers/authichain-license-issuer/scripts/provision.sh
#   Secrets are NOT set here — run scripts/rotate-secrets.sh (or wrangler secret put) first.
#
# USAGE
#   bash scripts/deploy-ready-workers.sh                # deploy all 5
#   bash scripts/deploy-ready-workers.sh authichain-chain-data   # deploy one
#
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-4c1869b90f13f86940aa3747839bf420}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WX="npx --yes wrangler@4"

ALL_WORKERS=(
  authichain-autopilot
  authichain-chain-data
  authichain-license-issuer
  authichain-qron-provenance
  authichain-scan-validate
)

# worker dir -> D1 database name (blank = no D1)
d1_db_for() {
  case "$1" in
    authichain-license-issuer)  echo "authichain-license-db" ;;
    authichain-qron-provenance) echo "authichain-provenance" ;;
    authichain-scan-validate)   echo "authichain-provenance" ;;
    *) echo "" ;;
  esac
}

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN is required."
  echo "  Create one at https://dash.cloudflare.com/profile/api-tokens"
  echo "  Permissions: Workers Scripts:Edit, D1:Edit, Workers KV Storage:Edit, Workers Routes:Edit"
  exit 1
fi

# Resolve the worker set (one arg = single worker, else all).
if [ "$#" -ge 1 ]; then
  TARGETS=("$1")
else
  TARGETS=("${ALL_WORKERS[@]}")
fi

deploy_one() {
  local name="$1"
  local dir="$REPO_ROOT/workers/$name"
  if [ ! -d "$dir" ]; then
    echo "✗ $name: directory not found ($dir)"; return 1
  fi
  echo "──────── deploying $name ────────"

  # Apply D1 migrations (idempotent) before the worker goes live.
  local db; db="$(d1_db_for "$name")"
  if [ -n "$db" ] && [ -d "$dir/migrations" ]; then
    echo "  applying D1 migrations to $db ..."
    ( cd "$dir" && $WX d1 migrations apply "$db" --remote ) || {
      echo "  ⚠ migration step failed — does the D1 database '$db' exist?"
      echo "    create it once with: cd workers/$name && $WX d1 create $db"
      echo "    then put the returned id into workers/$name/wrangler.toml"
      return 1
    }
  fi

  ( cd "$dir" && $WX deploy )
  echo "✓ $name deployed"
}

rc=0
for w in "${TARGETS[@]}"; do
  deploy_one "$w" || rc=1
done

echo ""
if [ "$rc" -eq 0 ]; then
  echo "✅ All requested workers deployed."
else
  echo "⚠ One or more workers failed — see messages above."
fi
exit "$rc"
