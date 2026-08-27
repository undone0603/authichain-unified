#!/bin/bash
# Push missing local .env keys to specified Vercel projects.
# Reads values from .env; never echoes them.
# Idempotent: skips keys already present in a given env.

set -u

EXCLUDE_LIST="VERCEL_TOKEN VERCEL_TEAM_ID VERCEL_PROJECT_AUTHI_CHAIN VERCEL_PROJECT_QRON_APP VERCEL_PROJECT_UNIFIED GOOGLE_SESSION_COOKIE LINKEDIN_SESSION_COOKIE POLYGON_SESSION_COOKIE REDDIT_SESSION_COOKIE SAM_AUTH_COOKIE TWITTER_SESSION_COOKIE OLLAMA_API_KEY OLLAMA_HOST OLLAMA_MODEL GITHUB_PAT_UNDONE GITHUB_PAT_ZKIE"

ENV_FILE="$(pwd)/.env"
WORKDIR=/tmp/vpush
mkdir -p "$WORKDIR"

: > "$WORKDIR/exclude.txt"
for k in $EXCLUDE_LIST; do echo "$k"; done | sort -u > "$WORKDIR/exclude.txt"

get_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" | head -1)
  [ -z "$line" ] && return 1
  local val="${line#${key}=}"
  val="${val%$'\r'}"
  if [[ ${#val} -ge 2 && "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then
    val="${val:1:${#val}-2}"
  elif [[ ${#val} -ge 2 && "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then
    val="${val:1:${#val}-2}"
  fi
  printf '%s' "$val"
}

add_one_env() {
  local linkdir="$1" key="$2" value="$3" env="$4" log="$5"
  if printf '%s' "$value" | vercel env add "$key" "$env" --yes --cwd "$linkdir" >>"$log" 2>&1; then
    return 0
  else
    return 1
  fi
}

process_project() {
  local linkdir="$1"
  local project="$2"
  local vercel_keys_file="$3"

  local log="$WORKDIR/${project}.log"
  : > "$log"

  echo "=== $project ===" | tee -a "$WORKDIR/summary.log"
  comm -23 /tmp/local_keys.txt "$vercel_keys_file" > "$WORKDIR/missing_${project}.txt"
  comm -23 "$WORKDIR/missing_${project}.txt" "$WORKDIR/exclude.txt" > "$WORKDIR/toadd_${project}.txt"
  local count
  count=$(wc -l < "$WORKDIR/toadd_${project}.txt")
  echo "Will add $count keys × 3 envs to $project" | tee -a "$WORKDIR/summary.log"

  local ok_p=0 ok_pr=0 ok_d=0 fail_p=0 fail_pr=0 fail_d=0 skipped=0 i=0
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    i=$((i+1))
    local value
    if ! value=$(get_value "$key") || [ -z "$value" ]; then
      skipped=$((skipped+1))
      echo "[$i/$count] $key SKIPPED" >>"$log"
      continue
    fi
    echo "--- [$i/$count] $key ---" >>"$log"
    add_one_env "$linkdir" "$key" "$value" production  "$log" && ok_p=$((ok_p+1))  || fail_p=$((fail_p+1))
    add_one_env "$linkdir" "$key" "$value" preview     "$log" && ok_pr=$((ok_pr+1)) || fail_pr=$((fail_pr+1))
    add_one_env "$linkdir" "$key" "$value" development "$log" && ok_d=$((ok_d+1))  || fail_d=$((fail_d+1))
  done < "$WORKDIR/toadd_${project}.txt"

  {
    echo "$project: prod ok=$ok_p fail=$fail_p | preview ok=$ok_pr fail=$fail_pr | dev ok=$ok_d fail=$fail_d | skipped=$skipped"
    echo "  log: $log"
  } | tee -a "$WORKDIR/summary.log"
}

main() {
  : > "$WORKDIR/summary.log"
  process_project /c/Users/rac/.vercel-multi/authichain-unified authichain-unified /tmp/au.txt
  process_project /c/Users/rac/.vercel-multi/qron-platform     qron-platform     /tmp/qp.txt
  process_project /c/Users/rac/.vercel-multi/strainchain-io    strainchain-io    /tmp/sc.txt
  process_project /c/Users/rac/.vercel-multi/govchain-us       govchain-us       /tmp/gc.txt
  echo "=== DONE ===" | tee -a "$WORKDIR/summary.log"
}

# Only run main when executed (not when sourced).
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  main "$@"
fi
