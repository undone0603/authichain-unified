#!/usr/bin/env bash
#
# operator.sh — control surface for the AuthiChain autonomous operator.
#
# Thin, auditable wrappers around the levers that ALREADY exist (the gh CLI,
# wrangler, and the workflow_dispatch workflows). Read-only by default; every
# state change is an explicit subcommand, and money movement requires a typed
# confirm. See OPERATOR.md for the operating model and delegation matrix.
#
# Prereqs: run from the repo root in a Codespace where `gh` is authenticated.
# Cloudflare-touching deploys/pipeline use GitHub-stored CLOUDFLARE_* secrets via
# the dispatched workflows, so no local Cloudflare auth is needed for those.
# Direct `wrangler` paths (pipeline off, payouts, secrets) need CLOUDFLARE_API_TOKEN.
#
set -euo pipefail

REPO="undone0603/authichain-unified"
WRANGLER="npx --yes wrangler"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }
need_gh() { command -v gh >/dev/null 2>&1 || { warn "gh CLI required and not found"; exit 1; }; }

cmd_status() {
  need_gh
  printf '\033[1m== main CI (last 5) ==\033[0m\n'
  gh run list --repo "$REPO" --branch main --limit 5 2>/dev/null || warn "could not read CI"
  printf '\n\033[1m== open PRs ==\033[0m\n'
  gh pr list --repo "$REPO" --state open --limit 30 2>/dev/null || warn "could not read PRs"
  printf '\n\033[1m== worker secret names (values never shown) ==\033[0m\n'
  $WRANGLER secret list 2>/dev/null || warn "need Cloudflare auth (export CLOUDFLARE_API_TOKEN) to list secrets"
}

cmd_protect() {
  need_gh
  gh api -X PUT "repos/$REPO/branches/main/protection" \
    -H "Accept: application/vnd.github+json" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Test suite (22.x, 3.12)"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
  ok "branch protection applied to main (Test suite required, admins enforced)"
}

cmd_pipeline() {
  case "${1:-}" in
    on)  need_gh; gh workflow run set-pipeline-enabled.yml --repo "$REPO" && ok "pipeline enable dispatched (AUTONOMOUS_PIPELINE_ENABLED=true)";;
    off) printf 'false' | $WRANGLER secret put AUTONOMOUS_PIPELINE_ENABLED >/dev/null && ok "AUTONOMOUS_PIPELINE_ENABLED=false";;
    *)   warn "usage: operator.sh pipeline on|off"; exit 1;;
  esac
}

cmd_payouts() {
  case "${1:-}" in
    on)
      warn "PAYOUTS_ENABLED lets approved batches disburse funds (per-batch human approval still applies)."
      read -rp "Type EXACTLY 'ENABLE PAYOUTS' to confirm: " c
      if [ "${c:-}" = "ENABLE PAYOUTS" ]; then printf 'true' | $WRANGLER secret put PAYOUTS_ENABLED >/dev/null && ok "PAYOUTS_ENABLED=true"; else warn "aborted"; fi;;
    off) printf 'false' | $WRANGLER secret put PAYOUTS_ENABLED >/dev/null && ok "PAYOUTS_ENABLED=false";;
    *)   warn "usage: operator.sh payouts on|off"; exit 1;;
  esac
}

cmd_deploy() {
  need_gh
  local w="${1:-}"
  if [ -n "$w" ]; then
    gh workflow run deploy-workers.yml --repo "$REPO" -f worker="$w" && ok "deploy dispatched for worker '$w'"
  else
    gh workflow run deploy-cloudflare.yml --repo "$REPO" && ok "root worker deploy dispatched"
    gh workflow run deploy-workers.yml --repo "$REPO" && ok "standalone workers deploy dispatched"
  fi
}

cmd_secrets() { $WRANGLER secret list 2>/dev/null || warn "need Cloudflare auth (export CLOUDFLARE_API_TOKEN)"; }

case "${1:-}" in
  status)   cmd_status;;
  protect)  cmd_protect;;
  pipeline) shift; cmd_pipeline "${@:-}";;
  payouts)  shift; cmd_payouts "${@:-}";;
  deploy)   shift; cmd_deploy "${@:-}";;
  secrets)  cmd_secrets;;
  *) cat <<'EOF'
operator.sh — AuthiChain autonomous operator control surface

  status            read-only: main CI, open PRs, worker secret names
  protect           apply branch protection to main (one-time)
  pipeline on|off   toggle AUTONOMOUS_PIPELINE_ENABLED
  payouts  on|off   toggle PAYOUTS_ENABLED (on requires typed confirm)
  deploy [worker]   dispatch a deploy (all, or one worker dir e.g. authichain-com)
  secrets           list configured worker secret names

See OPERATOR.md for the operating model, approval gates, and the delegation
matrix for routine vs. agent-delegable vs. human-only tasks.
EOF
  ;;
esac
