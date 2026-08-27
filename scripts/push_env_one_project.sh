#!/bin/bash
# Push missing local .env keys to ONE Vercel project, redeploy, audit.
# Usage: push_env_one_project.sh <linkdir> <project_name> <vercel_keys_snapshot>
# Idempotent: "already exists" treated as success.

set -u
LINKDIR="$1"
PROJECT="$2"
VERCEL_KEYS_FILE="$3"

EXCLUDE_LIST="VERCEL_TOKEN VERCEL_TEAM_ID VERCEL_PROJECT_AUTHI_CHAIN VERCEL_PROJECT_QRON_APP VERCEL_PROJECT_UNIFIED GOOGLE_SESSION_COOKIE LINKEDIN_SESSION_COOKIE POLYGON_SESSION_COOKIE REDDIT_SESSION_COOKIE SAM_AUTH_COOKIE TWITTER_SESSION_COOKIE OLLAMA_API_KEY OLLAMA_HOST OLLAMA_MODEL GITHUB_PAT_UNDONE GITHUB_PAT_ZKIE"

ENV_FILE="/c/Users/rac/OneDrive/Desktop/agentz/.env"
WORKDIR=/tmp/vpush
mkdir -p "$WORKDIR"

EXCLUDE_FILE="$WORKDIR/exclude.txt"
[ -s "$EXCLUDE_FILE" ] || { for k in $EXCLUDE_LIST; do echo "$k"; done | sort -u > "$EXCLUDE_FILE"; }

LOG="$WORKDIR/${PROJECT}.parallel.log"
: > "$LOG"

get_value() {
  local key="$1" line val
  line=$(grep -E "^${key}=" "$ENV_FILE" | head -1)
  [ -z "$line" ] && return 1
  val="${line#${key}=}"
  val="${val%$'\r'}"
  if [[ ${#val} -ge 2 && "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then val="${val:1:${#val}-2}"
  elif [[ ${#val} -ge 2 && "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then val="${val:1:${#val}-2}"
  fi
  printf '%s' "$val"
}

add_one_env() {
  local key="$1" value="$2" env="$3" out rc
  out=$(printf '%s' "$value" | vercel env add "$key" "$env" --yes --cwd "$LINKDIR" 2>&1)
  rc=$?
  if [ $rc -eq 0 ]; then
    echo "  $env OK" >>"$LOG"
    return 0
  fi
  if echo "$out" | grep -qE 'already exists|was created already'; then
    echo "  $env ALREADY-EXISTS" >>"$LOG"
    return 0
  fi
  echo "  $env FAIL: $out" >>"$LOG"
  return 1
}

echo "=== [$PROJECT] PUSH START $(date -Iseconds) ===" >>"$LOG"
comm -23 /tmp/local_keys.txt "$VERCEL_KEYS_FILE" > "$WORKDIR/missing_${PROJECT}.txt"
comm -23 "$WORKDIR/missing_${PROJECT}.txt" "$EXCLUDE_FILE" > "$WORKDIR/toadd_${PROJECT}.txt"
COUNT=$(wc -l < "$WORKDIR/toadd_${PROJECT}.txt")
echo "Plan: $COUNT keys × 3 envs" >>"$LOG"

ok=0 fail=0 skipped=0 i=0
while IFS= read -r key; do
  [ -z "$key" ] && continue
  i=$((i+1))
  value=$(get_value "$key" || true)
  if [ -z "$value" ]; then
    skipped=$((skipped+1))
    echo "[$i/$COUNT] $key SKIPPED (empty)" >>"$LOG"
    continue
  fi
  echo "[$i/$COUNT] $key" >>"$LOG"
  add_one_env "$key" "$value" production  && ok=$((ok+1)) || fail=$((fail+1))
  add_one_env "$key" "$value" preview     && ok=$((ok+1)) || fail=$((fail+1))
  add_one_env "$key" "$value" development && ok=$((ok+1)) || fail=$((fail+1))
done < "$WORKDIR/toadd_${PROJECT}.txt"

echo "[$PROJECT] PUSH DONE: ok=$ok fail=$fail skipped=$skipped" >>"$LOG"
echo "[$PROJECT] PUSH DONE: ok=$ok fail=$fail skipped=$skipped" >>"$WORKDIR/summary.parallel.log"

# Redeploy production to pick up new env vars
echo "=== [$PROJECT] REDEPLOY START $(date -Iseconds) ===" >>"$LOG"
if vercel deploy --prod --yes --cwd "$LINKDIR" >>"$LOG" 2>&1; then
  echo "[$PROJECT] REDEPLOY OK" >>"$LOG"
  echo "[$PROJECT] REDEPLOY OK" >>"$WORKDIR/summary.parallel.log"
else
  echo "[$PROJECT] REDEPLOY FAIL" >>"$LOG"
  echo "[$PROJECT] REDEPLOY FAIL" >>"$WORKDIR/summary.parallel.log"
fi

# Final gap audit
echo "=== [$PROJECT] AUDIT $(date -Iseconds) ===" >>"$LOG"
vercel env ls --cwd "$LINKDIR" 2>&1 | grep -E '^ [A-Z_]' | awk '{print $1}' | sort -u > "$WORKDIR/post_${PROJECT}.txt"
comm -23 /tmp/local_keys.txt "$WORKDIR/post_${PROJECT}.txt" | comm -23 - "$EXCLUDE_FILE" > "$WORKDIR/remaining_gap_${PROJECT}.txt"
GAP=$(wc -l < "$WORKDIR/remaining_gap_${PROJECT}.txt")
echo "[$PROJECT] AUDIT: remaining_gap=$GAP" >>"$LOG"
echo "[$PROJECT] AUDIT: remaining_gap=$GAP" >>"$WORKDIR/summary.parallel.log"
echo "=== [$PROJECT] ALL DONE $(date -Iseconds) ===" >>"$LOG"
echo "=== [$PROJECT] ALL DONE ===" >>"$WORKDIR/summary.parallel.log"
