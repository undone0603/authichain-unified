#!/usr/bin/env bash
# start-agentz.sh: restart the AgentZ API and connect the Cloudflare tunnel.
#
#   ./scripts/start-agentz.sh
#
# Put it in the repo root or anywhere inside the repo; it finds the root itself.
# Founder laptop bring-up only. Not a product. $0 named-tunnel path.
# Do not deploy workers/authichain-agentz / Containers.
#
# Secrets come from the environment or from .env.agentz in the repo root
# (plain NAME=value lines; keep it out of git and chmod 600). Anything still
# missing is prompted for without echoing, so nothing secret lands in your
# shell history or on a command line.
#
# AgentZ runs in the background and keeps running after you stop the tunnel
# with Ctrl-C. Its output goes to agentz.log in the repo root. Re-running this
# script replaces the old server. To stop it by hand:
#   pkill -f "uvicorn agentz.api.main:app"
#
# Optional overrides: AGENTZ_REPO, AGENTZ_ENV_FILE, AGENTZ_LOG, AGENTZ_PID_FILE,
# PYTHON, LOCAL_MODEL_URL, LOCAL_MODEL_ID, LOCAL_MODEL_TIMEOUT, AGENTZ_PLAN_TIMEOUT.
# If only LOCAL_MODEL_URL is set, the first model listed at
# $LOCAL_MODEL_URL/v1/models is used.

set -euo pipefail

PORT=8000   # the tunnel's ingress points at this port

# Matches only a Python process actually serving the app, whether started as
# "python -m uvicorn agentz.api.main:app" or via the "uvicorn" command, so a
# shell, editor or grep that merely mentions the name is never killed.
# [Pp]: macOS framework builds run as .../Python.app/Contents/MacOS/Python.
PATTERN='^[^ ]*[Pp]ython[^ ]* (-m |[^ ]*/)uvicorn agentz\.api\.main:app'

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

# ---- locate the repo --------------------------------------------------------
find_repo() {
  local d
  d=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/agentz/api" ]]; then echo "$d"; return 0; fi
    d=$(dirname "$d")
  done
  return 1
}
REPO_DIR="${AGENTZ_REPO:-$(find_repo || true)}"
[[ -n "$REPO_DIR" && -d "$REPO_DIR/agentz/api" ]] \
  || die "can't find the authichain-unified repo (set AGENTZ_REPO=/path/to/it)"

TUNNEL="$REPO_DIR/scripts/agentz-tunnel/run-with-api-token.sh"
[[ -x "$TUNNEL" ]] || die "tunnel script missing or not executable: $TUNNEL"

ENV_FILE="${AGENTZ_ENV_FILE:-$REPO_DIR/.env.agentz}"
LOG_FILE="${AGENTZ_LOG:-$REPO_DIR/agentz.log}"
PID_FILE="${AGENTZ_PID_FILE:-$REPO_DIR/.agentz.pid}"

PYTHON="${PYTHON:-$(command -v python || command -v python3 || true)}"
[[ -n "$PYTHON" ]] || die "python not found (set PYTHON=/path/to/python)"

# ---- gather settings up front, so all prompts happen before anything stops ---
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

need() {  # need NAME [secret]
  local var=$1 secret=${2:-}
  if [[ -z "${!var:-}" ]]; then
    [[ -t 0 ]] || die "$var is not set (export it or add it to $ENV_FILE)"
    if [[ -n "$secret" ]]; then
      read -rsp "$var: " "${var?}"; echo
    else
      read -rp "$var: " "${var?}"
    fi
  fi
  [[ -n "${!var:-}" ]] || die "$var is required"
}

need AGENT_SECRET secret            # must match GitHub AGENT_SECRET / claw AGENTZ_API_KEY
need SUPABASE_URL
need SUPABASE_SERVICE_ROLE_KEY secret
need CLOUDFLARE_API_TOKEN secret
need CLOUDFLARE_ACCOUNT_ID

if [[ -n "${LOCAL_MODEL_URL:-}" && -z "${LOCAL_MODEL_ID:-}" ]]; then
  if LOCAL_MODEL_ID=$("$PYTHON" - "$LOCAL_MODEL_URL" 2>/dev/null <<'PY'
import json, sys, urllib.request
with urllib.request.urlopen(sys.argv[1].rstrip("/") + "/v1/models", timeout=5) as r:
    print(json.load(r)["data"][0]["id"])
PY
  ); then
    info "Local model: $LOCAL_MODEL_ID"
  else
    echo "warning: couldn't read a model id from $LOCAL_MODEL_URL/v1/models;" \
         "starting without the local model" >&2
    unset LOCAL_MODEL_URL LOCAL_MODEL_ID
  fi
fi

# Returns success if something accepts connections on 127.0.0.1:$PORT.
listening() {
  "$PYTHON" -c 'import socket, sys
s = socket.socket(); s.settimeout(0.5)
sys.exit(s.connect_ex(("127.0.0.1", int(sys.argv[1]))) != 0)' "$PORT"
}

# ---- 1. stop the old server and wait until it has actually exited ----------
if old_pids=$(pgrep -f "$PATTERN"); then
  info "Stopping the old AgentZ server (pid $(echo "$old_pids" | tr '\n' ' '| sed 's/ $//'))"
  pkill -f "$PATTERN" || true
  for _ in {1..20}; do
    pgrep -f "$PATTERN" >/dev/null || break
    sleep 0.5
  done
  if pgrep -f "$PATTERN" >/dev/null; then
    info "Still running after 10s; forcing it"
    pkill -9 -f "$PATTERN" || true
    sleep 1
  fi
fi
if listening; then
  die "something else is already listening on 127.0.0.1:$PORT"
fi

# ---- 2+3. start AgentZ detached, with its secrets scoped to that process ----
info "Starting AgentZ on 127.0.0.1:$PORT (log: $LOG_FILE)"
echo "---- $(date '+%Y-%m-%d %H:%M:%S') start ----" >>"$LOG_FILE"

# Job control gives the server its own process group, so Ctrl-C on the
# tunnel doesn't reach it.
if [[ -t 0 ]]; then set -m; fi
(
  cd "$REPO_DIR"
  export PYTHONPATH="$REPO_DIR"
  export AGENT_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
  unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID   # the server doesn't need these
  if [[ -n "${LOCAL_MODEL_ID:-}" ]]; then export LOCAL_MODEL_URL LOCAL_MODEL_ID; fi
  if [[ -n "${LOCAL_MODEL_TIMEOUT:-}" ]]; then export LOCAL_MODEL_TIMEOUT; fi
  if [[ -n "${AGENTZ_PLAN_TIMEOUT:-}" ]]; then export AGENTZ_PLAN_TIMEOUT; fi
  exec nohup "$PYTHON" -m uvicorn agentz.api.main:app --host 127.0.0.1 --port "$PORT"
) </dev/null >>"$LOG_FILE" 2>&1 &
server_pid=$!
set +m

for _ in {1..30}; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    tail -n 20 "$LOG_FILE" >&2
    die "AgentZ exited during startup (last log lines above)"
  fi
  if listening; then break; fi
  sleep 1
done
listening || die "AgentZ didn't start listening within 30s; see $LOG_FILE"

# Fail closed if the process is up but /health is not JSON.
if ! "$PYTHON" -c 'import json,urllib.request,sys
r=urllib.request.urlopen("http://127.0.0.1:%s/health" % sys.argv[1], timeout=3)
json.load(r)' "$PORT" 2>/dev/null; then
  tail -n 20 "$LOG_FILE" >&2
  die "AgentZ listened but /health failed; see $LOG_FILE"
fi

printf '%s\n' "$server_pid" >"$PID_FILE"
info "AgentZ is up (pid $server_pid)"
echo "{\"event\":\"agentz.up\",\"pid\":$server_pid,\"port\":$PORT,\"health\":\"ok\"}" >>"$LOG_FILE"

# ---- 4. tunnel: gets only the Cloudflare credentials, not AgentZ's secrets --
export -n AGENT_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY \
          LOCAL_MODEL_URL LOCAL_MODEL_ID LOCAL_MODEL_TIMEOUT AGENTZ_PLAN_TIMEOUT 2>/dev/null || true
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

info "Starting the tunnel connector (Ctrl-C stops the tunnel; AgentZ keeps running)"
cd "$REPO_DIR"
exec "$TUNNEL"
