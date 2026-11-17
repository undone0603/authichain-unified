#!/usr/bin/env bash
# One-time ADMIN setup for the automated (human-review-free) Worker release.
# Run LOCALLY in your authenticated gh CLI. Do not paste any token into chat.
set -euo pipefail
umask 077
REPO='undone0603/authichain-unified'
ENV='production-cloudflare'
ACCOUNT='4c1869b90f13f86940aa3747839bf420'
TOKEN_SECRET='AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN'
ACCOUNT_SECRET='AUTHICHAIN_PRODUCTION_CLOUDFLARE_ACCOUNT_ID'
fail() { echo "BLOCKED: $*" >&2; exit 1; }
command -v gh >/dev/null || fail 'Install GitHub CLI (gh).'
command -v python3 >/dev/null || fail 'Install Python 3.'
gh auth status --hostname github.com >/dev/null 2>&1 || fail 'Run gh auth login.'
ROLE=$(gh api "repos/$REPO" --jq '.permissions.admin') || fail 'Cannot check administrator rights.'
[[ "$ROLE" == true ]] || fail 'GitHub administrator access is required for this setup.'
RULE=$(gh api "repos/$REPO/rulesets/24073494") || fail 'Cannot read protected main ruleset.'
printf '%s' "$RULE" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["enforcement"]=="active";assert "refs/heads/main" in d["conditions"]["ref_name"]["include"];assert any(r["type"]=="pull_request" for r in d["rules"])' || fail 'main PR ruleset is not active.'
# Never allow GitHub to fall back to same-named repository secrets.
REPO_NAMES=$(gh secret list -R "$REPO" --json name --jq '.[].name') || fail 'Cannot inspect repository secret names.'
if printf '%s\n' "$REPO_NAMES" | grep -Ex "($TOKEN_SECRET|$ACCOUNT_SECRET)" >/dev/null; then
  fail 'Repository-scoped release secret aliases exist. Remove those aliases under explicit admin control before proceeding.'
fi
# Never modify an existing environment that may carry protections or secrets.
if gh api "repos/$REPO/environments/$ENV" >/dev/null 2>&1; then
  echo 'Environment exists. Validating without changing its rules.'
else
  printf '%s' '{"wait_timer":0,"reviewers":[],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}' |
    gh api -X PUT "repos/$REPO/environments/$ENV" --input - >/dev/null || fail 'Cannot create protected environment.'
fi
ENV_JSON=$(gh api "repos/$REPO/environments/$ENV") || fail 'Cannot read environment.'
printf '%s' "$ENV_JSON" | python3 -c '
import json,sys
x=json.load(sys.stdin)
assert x["name"]=="production-cloudflare"
assert x["deployment_branch_policy"]=={"protected_branches":True,"custom_branch_policies":False}
assert x.get("protection_rules")==[], "Automated policy forbids all reviewer, wait-timer, or custom protection rules"
' || fail 'Existing environment rules differ from the approved automated policy.'
EXISTING=$(gh secret list -R "$REPO" -e "$ENV" --json name --jq '.[].name') || fail 'Cannot inspect environment secrets.'
while IFS= read -r name; do
  [[ -z "$name" || "$name" == "$TOKEN_SECRET" || "$name" == "$ACCOUNT_SECRET" ]] || fail "Unexpected existing environment secret name: $name"
done <<< "$EXISTING"
echo 'Create a Cloudflare API token scoped to the EXISTING authichain-com Worker with Workers Editor only.'
echo 'Do not grant DNS, zone, D1, R2, billing or account-token-administration permissions.'
printf 'Paste the new token into this hidden LOCAL terminal prompt: '
IFS= read -rs TOKEN
echo
[[ -n "$TOKEN" ]] || fail 'Empty token.'
printf %s "$TOKEN" | gh secret set "$TOKEN_SECRET" -R "$REPO" -e "$ENV" || fail 'Token secret upload failed.'
unset TOKEN
printf %s "$ACCOUNT" | gh secret set "$ACCOUNT_SECRET" -R "$REPO" -e "$ENV" || fail 'Account secret upload failed.'
AFTER=$(gh secret list -R "$REPO" -e "$ENV" --json name --jq '.[].name' | sort) || fail 'Cannot confirm secret names.'
EXPECTED=$(printf '%s\n' "$TOKEN_SECRET" "$ACCOUNT_SECRET" | sort)
[[ "$AFTER" == "$EXPECTED" ]] || fail 'Environment secret inventory differs from the approved pair.'
echo 'AUTONOMOUS ENVIRONMENT READY: protected main only; no environment reviewer; two dedicated environment secrets.'
echo 'Do NOT dispatch until the automated policy PR is merged and NEW main has 7/7 successful CircleCI statuses.'
