#!/usr/bin/env bash
# Owner/box connector for the $0 AgentZ named tunnel.
#
# Actions configures Cloudflare (DNS + Worker route cleanup). It cannot hand a
# live token to this machine. This script mints a short-lived run token with
# CLOUDFLARE_API_TOKEN (same secret Actions uses) and starts cloudflared.
# The token is never printed.
#
#   export CLOUDFLARE_API_TOKEN=...   # Cloudflare API Token, not a Global Key
#   export CLOUDFLARE_ACCOUNT_ID=...
#   # optional: start uvicorn first on 127.0.0.1:8000
#   ./scripts/agentz-tunnel/run-with-api-token.sh
#
# Equivalent once you already have a token (e.g. 1-day Actions artifact):
#   cloudflared tunnel run --token "$TOKEN"
#
# Do not invent OPENCLAW_GATEWAY_URL. Do not enable Workers Paid / Containers.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUNNEL_UUID="${TUNNEL_UUID:-08378b03-f6a2-46cf-aab8-a2754bad869f}"
TUNNEL_HOSTNAME="${TUNNEL_HOSTNAME:-agentz.authichain.com}"
ORIGIN="${AGENTZ_ORIGIN:-http://127.0.0.1:8000}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (the same Actions secrets)." >&2
  echo "Do not paste them into chat. Do not use cloudflared login cert unless you already have one." >&2
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not on PATH. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi

TOKEN_FILE="$(mktemp)"
cleanup() { rm -f "$TOKEN_FILE"; }
trap cleanup EXIT
chmod 600 "$TOKEN_FILE"

TUNNEL_TOKEN_OUT="$TOKEN_FILE" \
  TUNNEL_UUID="$TUNNEL_UUID" \
  TUNNEL_HOSTNAME="$TUNNEL_HOSTNAME" \
  PUT_TUNNEL_INGRESS="${PUT_TUNNEL_INGRESS:-1}" \
  "$SCRIPT_DIR/cf-bringup.sh"

if [ ! -s "$TOKEN_FILE" ]; then
  echo "No run token written. Check Cloudflare Tunnel Read on the API token." >&2
  echo "Fallback (local cert + config.yml): cloudflared tunnel --config ${SCRIPT_DIR}/config.yml run" >&2
  exit 1
fi

echo "starting cloudflared tunnel run --token (token not printed) origin hint ${ORIGIN}"
echo "uvicorn should already be listening on ${ORIGIN}"
TOKEN="$(cat "$TOKEN_FILE")"
rm -f "$TOKEN_FILE"
trap - EXIT
exec cloudflared tunnel run --token "$TOKEN"
