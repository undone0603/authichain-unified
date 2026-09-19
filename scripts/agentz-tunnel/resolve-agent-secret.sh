#!/usr/bin/env bash
# Resolve AGENT_SECRET for claw AGENTZ_API_KEY. Never prints the value.
#
# If secrets.AGENT_SECRET is already set, reuse it.
# If empty and DEV_TEAM_GITHUB_TOKEN or GH_PAT can write repo secrets, mint
# once, `gh secret set AGENT_SECRET`, and write the value to AGENT_SECRET_OUT
# so this job can bind claw (the Actions UI cannot read the secret back).
# If empty and no PAT, fail — owner must set AGENT_SECRET in repo settings
# (do not paste into chat). Do not mint a throwaway key that the next run
# would rotate.
#
# Required: AGENT_SECRET_OUT
# Optional: AGENT_SECRET, DEV_TEAM_GITHUB_TOKEN, GH_PAT
set -euo pipefail

if [ -z "${AGENT_SECRET_OUT:-}" ]; then
  echo "::error::AGENT_SECRET_OUT is required"
  exit 1
fi

umask 077
mkdir -p "$(dirname "$AGENT_SECRET_OUT")"

if [ -n "${AGENT_SECRET:-}" ]; then
  printf '%s' "$AGENT_SECRET" > "$AGENT_SECRET_OUT"
  chmod 600 "$AGENT_SECRET_OUT"
  echo "using existing GitHub secret AGENT_SECRET (value not logged)"
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "minted_agent_secret=false" >> "$GITHUB_ENV"
  fi
  exit 0
fi

if [ -n "${DEV_TEAM_GITHUB_TOKEN:-}" ]; then
  PAT="$DEV_TEAM_GITHUB_TOKEN"
elif [ -n "${GH_PAT:-}" ]; then
  PAT="$GH_PAT"
else
  echo "::error::GitHub secret AGENT_SECRET is empty. Set AGENT_SECRET under repo Actions secrets (Settings → Secrets and variables → Actions). Do not paste it into chat. A one-time mint is only possible when DEV_TEAM_GITHUB_TOKEN or GH_PAT can write repo secrets. Tunnel DNS + Worker route cleanup do not need AGENT_SECRET."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "::error::gh CLI is required to persist a minted AGENT_SECRET"
  exit 1
fi

openssl rand -base64 32 | tr -d '\n' > "$AGENT_SECRET_OUT"
chmod 600 "$AGENT_SECRET_OUT"
if [ ! -s "$AGENT_SECRET_OUT" ]; then
  echo "::error::failed to mint AGENT_SECRET"
  exit 1
fi

GH_TOKEN="$PAT" gh secret set AGENT_SECRET --app actions --body-file "$AGENT_SECRET_OUT"
echo "minted AGENT_SECRET and stored it as a repo Actions secret (value not logged)"
echo "download the 1-day artifact to set local uvicorn AGENT_SECRET — the Actions UI cannot show secret values"
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "minted_agent_secret=true" >> "$GITHUB_ENV"
fi
