#!/usr/bin/env bash
set -euo pipefail
REPO="${AUTHICHAIN_REPO:-/tmp/authichain-prs/outreach-activate}"
LOG="${OUTREACH_WATCH_LOG:-/home/zac/.grok/long-running-background-tasks/outreach_wait_buyer.log}"
STATE="${OUTREACH_WATCH_STATE:-/home/zac/.grok/long-running-background-tasks/outreach_wait_buyer_state.json}"
POLL="${OUTREACH_WATCH_POLL:-90}"
mkdir -p "$(dirname "$LOG")"

# Safe KEY=VALUE load: never eval, quote values (app passwords contain spaces).
load_env_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    [[ "$line" == *=* ]] || continue
    local k="${line%%=*}"
    local v="${line#*=}"
    # strip surrounding single/double quotes
    if [[ "${v:0:1}" == '"' && "${v: -1}" == '"' ]]; then v="${v:1:-1}"; fi
    if [[ "${v:0:1}" == "'" && "${v: -1}" == "'" ]]; then v="${v:1:-1}"; fi
    # only export simple KEY names
    [[ "$k" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    export "$k=$v"
  done < "$f"
}
load_env_file /home/zac/.config/grok-secrets/secrets.env
load_env_file /home/zac/projects/authichain-unified/.env

cd "$REPO"
# ensure pnpm/node_modules for decide
[ -e node_modules ] || ln -sfn /home/zac/projects/authichain-unified/node_modules node_modules

prev=""
while :; do
  out=$(pnpm exec tsx scripts/revenue-operator.ts decide --skip-rails 2>/dev/null || true)
  action=$(printf '%s' "$out" | python3 -c 'import sys,json
t=sys.stdin.read(); i=t.rfind("{");
print(json.loads(t[i:]).get("action","?") if i>=0 else "?")' 2>/dev/null || echo "?")
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) action=$action" >>"$LOG"
  if [ "$action" = "qualifying" ]; then
    echo "ACTION_REQUIRED: revenue qualifying"
  elif [ "$action" = "send_one" ] && [ "$action" != "$prev" ]; then
    echo "ACTION_REQUIRED: send_one ready (manual/operator path only)"
  fi
  prev=$action
  printf '%s\n' "{\"last_action\":\"$action\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >"$STATE"
  sleep "$POLL"
done
