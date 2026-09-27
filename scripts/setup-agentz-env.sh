#!/usr/bin/env bash
# setup-agentz-env.sh: write .env.agentz for start-agentz.sh, make it readable
# only by you (chmod 600), and add it and agentz.log to .gitignore.
#
#   ./scripts/setup-agentz-env.sh
#
# Put it anywhere inside the authichain-unified repo (next to start-agentz.sh
# is fine); it finds the repo root itself. You type each value at a prompt,
# secrets aren't echoed, and nothing lands in your shell history.
#
# Safe to re-run: press Enter at a prompt to keep the current value.
# Founder laptop bring-up only. Not a product.

set -euo pipefail

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

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
[[ -t 0 ]] || die "run this in a terminal; it prompts for each value"

ENV_FILE="$REPO_DIR/.env.agentz"
GITIGNORE="$REPO_DIR/.gitignore"
VARS=(AGENT_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
      CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
      LOCAL_MODEL_URL LOCAL_MODEL_ID
      LOCAL_MODEL_TIMEOUT AGENTZ_PLAN_TIMEOUT)

# ---- current values become the defaults ------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  info "Updating $ENV_FILE (Enter keeps the current value)"
else
  info "Creating $ENV_FILE"
fi

ask() {  # ask NAME secret|text|optional "hint"
  local var=$1 kind=$2 hint=$3 cur val prompt
  cur=${!var:-}
  prompt=$var
  if [[ -n "$hint" ]]; then prompt+=" ($hint)"; fi
  if [[ -n "$cur" ]]; then
    if [[ $kind == secret ]]; then prompt+=" [already set]"; else prompt+=" [$cur]"; fi
    if [[ $kind == optional ]]; then prompt+=" (- to clear)"; fi
  fi
  while :; do
    if [[ $kind == secret ]]; then
      read -rsp "$prompt: " val; echo
    else
      read -rp "$prompt: " val
    fi
    if [[ $kind == optional && $val == "-" ]]; then val=""; break; fi
    val=${val:-$cur}
    if [[ -n "$val" || $kind == optional ]]; then break; fi
    echo "  $var is required" >&2
  done
  printf -v "$var" '%s' "$val"
}

ask AGENT_SECRET              secret   "must match GitHub AGENT_SECRET / claw AGENTZ_API_KEY"
ask SUPABASE_URL              text     ""
ask SUPABASE_SERVICE_ROLE_KEY secret   ""
ask CLOUDFLARE_API_TOKEN      secret   ""
ask CLOUDFLARE_ACCOUNT_ID     text     ""
ask LOCAL_MODEL_URL           optional "optional, e.g. http://127.0.0.1:1234"
if [[ -n "$LOCAL_MODEL_URL" ]]; then
  ask LOCAL_MODEL_ID          optional "optional; leave empty to use the first model it lists"
  ask LOCAL_MODEL_TIMEOUT     optional "seconds per local attempt (5-120, default 40)"
  ask AGENTZ_PLAN_TIMEOUT     optional "whole plan call seconds (5-300, default 80)"
else
  # shellcheck disable=SC2034  # read indirectly via ${!var} below
  LOCAL_MODEL_ID=""
  LOCAL_MODEL_TIMEOUT=""
  AGENTZ_PLAN_TIMEOUT=""
fi

# ---- write the file: created 600, filled, then moved into place ------------
# Values are shell-quoted (%q) because start-agentz.sh sources this file, so
# characters like $ or quotes in a key survive intact.
tmp=$(mktemp "$REPO_DIR/.env.agentz.XXXXXX")
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
{
  echo "# Settings for start-agentz.sh. Contains secrets: never commit this file."
  for var in "${VARS[@]}"; do
    if [[ -n "${!var:-}" ]]; then printf '%s=%q\n' "$var" "${!var}"; fi
  done
} >"$tmp"
mv -f "$tmp" "$ENV_FILE"
trap - EXIT
chmod 600 "$ENV_FILE"
info "Wrote $ENV_FILE (mode 600: only you can read it)"

# ---- .gitignore --------------------------------------------------------------
added=()
for entry in .env.agentz agentz.log .agentz.pid; do
  re="^/?${entry//./\\.}$"
  if [[ -f "$GITIGNORE" ]] && grep -qE "$re" "$GITIGNORE"; then continue; fi
  if [[ ${#added[@]} -eq 0 ]]; then
    # start on a fresh line if the file doesn't end with one
    if [[ -s "$GITIGNORE" && -n "$(tail -c1 "$GITIGNORE")" ]]; then echo >>"$GITIGNORE"; fi
    echo "# AgentZ local secrets and server log (start-agentz.sh)" >>"$GITIGNORE"
  fi
  echo "$entry" >>"$GITIGNORE"
  added+=("$entry")
done
if [[ ${#added[@]} -gt 0 ]]; then
  info "Added to .gitignore: ${added[*]}"
else
  info ".gitignore already lists .env.agentz, agentz.log, and .agentz.pid"
fi

# ---- git sanity checks -------------------------------------------------------
if git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  for f in .env.agentz agentz.log .agentz.pid; do
    if git -C "$REPO_DIR" ls-files --error-unmatch -- "$f" >/dev/null 2>&1; then
      echo "warning: $f is already tracked by git, so .gitignore won't hide it." >&2
      echo "         Untrack it with: git rm --cached $f" >&2
      if [[ $f == .env.agentz ]]; then
        echo "         Its secrets are in your git history; rotate them." >&2
      fi
    elif ! git -C "$REPO_DIR" check-ignore -q -- "$f"; then
      echo "warning: git still doesn't ignore $f; check .gitignore for a '!' rule." >&2
    fi
  done
  if [[ ${#added[@]} -gt 0 ]]; then
    echo "Commit the .gitignore change when ready:"
    echo "  git add .gitignore && git commit -m 'Ignore AgentZ env file and log'"
  fi
fi
