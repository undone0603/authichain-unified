#!/usr/bin/env bash
# Configure the Cloudflare side of the $0 AgentZ named tunnel.
# Never prints tunnel tokens or other secret values.
#
# Required:
#   CLOUDFLARE_API_TOKEN
#   CLOUDFLARE_ACCOUNT_ID
# Optional:
#   TUNNEL_UUID          default 08378b03-f6a2-46cf-aab8-a2754bad869f
#   TUNNEL_HOSTNAME      default agentz.authichain.com
#   ZONE_NAME            default authichain.com
#   TUNNEL_TOKEN_OUT     if set, write the run token here (file mode 0600)
#   PUT_TUNNEL_INGRESS   default 1 — try to store ingress on the tunnel
#
# Exits 0 when tunnel exists, DNS CNAME is proxied, and the Worker route is gone.
# Token mint failure is a notice, not a hard fail (owner can mint locally).
set -euo pipefail

TUNNEL_UUID="${TUNNEL_UUID:-08378b03-f6a2-46cf-aab8-a2754bad869f}"
TUNNEL_HOSTNAME="${TUNNEL_HOSTNAME:-agentz.authichain.com}"
ZONE_NAME="${ZONE_NAME:-authichain.com}"
CNAME_TARGET="${TUNNEL_UUID}.cfargotunnel.com"
PUT_TUNNEL_INGRESS="${PUT_TUNNEL_INGRESS:-1}"
API="https://api.cloudflare.com/client/v4"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "::error::CLOUDFLARE_API_TOKEN is empty. Set the repo Actions secret (API Token, not a Global API Key)."
  exit 1
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "::error::CLOUDFLARE_ACCOUNT_ID is empty. Set the repo Actions secret."
  exit 1
fi

cf_req() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local tmp
  tmp="$(mktemp)"
  local args=(-sS -X "$method" "$url"
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
    -H "Content-Type: application/json"
    -o "$tmp" -w "%{http_code}")
  local code
  if [ -n "$data" ]; then
    code="$(curl "${args[@]}" --data "$data")"
  else
    code="$(curl "${args[@]}")"
  fi
  CF_HTTP_CODE="$code"
  CF_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

cf_ok() {
  [ -n "${CF_HTTP_CODE:-}" ] && [ "$CF_HTTP_CODE" -ge 200 ] && [ "$CF_HTTP_CODE" -lt 300 ] &&
    [ "$(echo "$CF_BODY" | jq -r '.success // false' 2>/dev/null || echo false)" = "true" ]
}

echo_cf_error() {
  local label="$1"
  echo "::error::${label} (HTTP ${CF_HTTP_CODE})"
  echo "$CF_BODY" | jq -c '{success,errors,messages}' 2>/dev/null || echo "$CF_BODY" | head -c 800
}

# --- verify named tunnel ----------------------------------------------------
echo "GET tunnel ${TUNNEL_UUID}"
cf_req GET "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_UUID}"
if ! cf_ok; then
  echo "cfd_tunnel GET failed; trying /tunnels"
  cf_req GET "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/tunnels/${TUNNEL_UUID}"
fi
if ! cf_ok; then
  echo_cf_error "Could not GET tunnel ${TUNNEL_UUID}. Token needs Account.Cloudflare Tunnel Read."
  exit 1
fi

TUNNEL_NAME="$(echo "$CF_BODY" | jq -r '.result.name // empty')"
TUNNEL_STATUS="$(echo "$CF_BODY" | jq -r '.result.status // .result.connections // "unknown" | if type=="array" then "listed" else . end')"
echo "tunnel ok name=${TUNNEL_NAME:-?} id=${TUNNEL_UUID} status=${TUNNEL_STATUS}"

# Best-effort remote ingress so `cloudflared tunnel run --token` has a service.
if [ "$PUT_TUNNEL_INGRESS" = "1" ]; then
  INGRESS="$(jq -n --arg host "$TUNNEL_HOSTNAME" '{
    config: {
      ingress: [
        {hostname: $host, service: "http://127.0.0.1:8000"},
        {service: "http_status:404"}
      ]
    }
  }')"
  echo "PUT tunnel ingress ${TUNNEL_HOSTNAME} -> http://127.0.0.1:8000"
  cf_req PUT "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_UUID}/configurations" "$INGRESS"
  if cf_ok; then
    echo "tunnel ingress stored (remotely managed)"
  else
    echo "::notice::Could not PUT tunnel ingress (often locally-managed tunnels). Owner box can use scripts/agentz-tunnel/config.yml. HTTP ${CF_HTTP_CODE}"
    echo "$CF_BODY" | jq -c '{success,errors}' 2>/dev/null || true
  fi
fi

# --- zone -------------------------------------------------------------------
echo "GET zone ${ZONE_NAME}"
cf_req GET "${API}/zones?name=${ZONE_NAME}"
if ! cf_ok; then
  echo_cf_error "Could not resolve zone ${ZONE_NAME}. Token needs Zone.Zone Read."
  exit 1
fi
ZONE_ID="$(echo "$CF_BODY" | jq -r '.result[0].id // empty')"
if [ -z "$ZONE_ID" ]; then
  echo "::error::No zone id for ${ZONE_NAME}"
  exit 1
fi
echo "zone ${ZONE_NAME} id=${ZONE_ID}"

# --- DNS CNAME (proxied) ----------------------------------------------------
echo "GET DNS records for ${TUNNEL_HOSTNAME}"
cf_req GET "${API}/zones/${ZONE_ID}/dns_records?name=${TUNNEL_HOSTNAME}"
if ! cf_ok; then
  echo_cf_error "Could not list DNS records. Token needs Zone.DNS Read."
  exit 1
fi

RECORD_JSON="$(echo "$CF_BODY" | jq -c --arg target "$CNAME_TARGET" --arg name "$TUNNEL_HOSTNAME" '
  .result
  | map(select(.name == $name))
')"
CORRECT_ID="$(echo "$RECORD_JSON" | jq -r --arg target "$CNAME_TARGET" '
  .[] | select(.type=="CNAME" and (.content|ascii_downcase)==($target|ascii_downcase) and .proxied==true) | .id
' | head -n1)"

if [ -n "$CORRECT_ID" ]; then
  echo "DNS CNAME already ${TUNNEL_HOSTNAME} -> ${CNAME_TARGET} proxied (id ${CORRECT_ID})"
else
  # Drop conflicting records on this hostname (A/AAAA leftover from Workers, wrong CNAME).
  while read -r rid; do
    [ -z "$rid" ] && continue
    echo "DELETE conflicting DNS record ${rid}"
    cf_req DELETE "${API}/zones/${ZONE_ID}/dns_records/${rid}"
    if ! cf_ok; then
      echo_cf_error "Failed to delete DNS record ${rid}"
      exit 1
    fi
  done < <(echo "$RECORD_JSON" | jq -r '.[].id')
  echo "POST CNAME ${TUNNEL_HOSTNAME} -> ${CNAME_TARGET} proxied"
  PAYLOAD="$(jq -n --arg name "$TUNNEL_HOSTNAME" --arg content "$CNAME_TARGET" \
    '{type:"CNAME",name:$name,content:$content,ttl:1,proxied:true}')"
  cf_req POST "${API}/zones/${ZONE_ID}/dns_records" "$PAYLOAD"
  if ! cf_ok; then
    CODE="$(echo "$CF_BODY" | jq -r '.errors[0].code // empty')"
    if [ "$CODE" = "81057" ]; then
      echo "DNS record already exists (81057). Treating as success."
    else
      echo_cf_error "Failed to create CNAME. Token needs Zone.DNS Edit."
      exit 1
    fi
  else
    echo "DNS CNAME created"
  fi
fi

# --- Worker routes + custom domains -----------------------------------------
echo "GET zone Worker routes"
cf_req GET "${API}/zones/${ZONE_ID}/workers/routes"
if cf_ok; then
  while IFS=$'\t' read -r rid script pattern; do
    [ -z "${rid:-}" ] && continue
    echo "DELETE Worker route ${rid} script=${script} pattern=${pattern}"
    cf_req DELETE "${API}/zones/${ZONE_ID}/workers/routes/${rid}"
    if cf_ok; then
      echo "deleted Worker route ${rid}"
    else
      echo_cf_error "Failed to delete Worker route ${rid}. Token needs Zone.Workers Routes Edit."
      exit 1
    fi
  done < <(echo "$CF_BODY" | jq -r --arg pat "${TUNNEL_HOSTNAME}/*" --arg host "$TUNNEL_HOSTNAME" '
    .result[]
    | select((.pattern // "") == $pat or (.pattern // "" | startswith($host)))
    | [.id, (.script // .script_name // "?"), (.pattern // "")]
    | @tsv
  ')
else
  echo "::notice::Could not list zone Worker routes (HTTP ${CF_HTTP_CODE}). Trying account script routes."
fi

echo "GET authichain-agentz script routes"
cf_req GET "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/authichain-agentz/routes"
if cf_ok; then
  while IFS=$'\t' read -r rid pattern; do
    [ -z "${rid:-}" ] && continue
    echo "DELETE script route ${rid} pattern=${pattern}"
    cf_req DELETE "${API}/zones/${ZONE_ID}/workers/routes/${rid}"
    if cf_ok; then
      echo "deleted script route ${rid}"
    else
      echo "::notice::Could not DELETE script route ${rid} (HTTP ${CF_HTTP_CODE})"
    fi
  done < <(echo "$CF_BODY" | jq -r --arg host "$TUNNEL_HOSTNAME" '
    .result[]
    | select((.pattern // "") | contains($host))
    | [.id, (.pattern // "")]
    | @tsv
  ')
else
  echo "authichain-agentz script routes not listed (HTTP ${CF_HTTP_CODE}) — script may be absent (OK on \$0 path)"
fi

echo "GET Worker custom domains"
cf_req GET "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains"
if cf_ok; then
  while IFS=$'\t' read -r did service; do
    [ -z "${did:-}" ] && continue
    echo "DELETE Worker custom domain ${did} service=${service}"
    cf_req DELETE "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains/${did}"
    if cf_ok; then
      echo "deleted Worker custom domain ${did}"
    else
      echo "::notice::Could not DELETE Worker custom domain ${did} (HTTP ${CF_HTTP_CODE})"
    fi
  done < <(echo "$CF_BODY" | jq -r --arg host "$TUNNEL_HOSTNAME" '
    .result[]
    | select((.hostname // "") == $host)
    | [.id, (.service // .script // "?")]
    | @tsv
  ')
fi

# --- mint run token (optional write) ----------------------------------------
echo "GET tunnel run token (value not logged)"
cf_req GET "${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_UUID}/token"
TOKEN=""
if cf_ok; then
  TOKEN="$(echo "$CF_BODY" | jq -r '
    .result
    | if type=="string" then .
      elif type=="object" then (.token // .value // empty)
      else empty end
  ')"
fi
if [ -z "$TOKEN" ]; then
  echo "::notice::Could not mint tunnel run token (HTTP ${CF_HTTP_CODE}). Owner box: scripts/agentz-tunnel/run-with-api-token.sh using CLOUDFLARE_API_TOKEN. Token needs Account.Cloudflare Tunnel Read."
  echo "$CF_BODY" | jq -c '{success,errors}' 2>/dev/null || true
  exit 0
fi

if [ -n "${TUNNEL_TOKEN_OUT:-}" ]; then
  umask 077
  mkdir -p "$(dirname "$TUNNEL_TOKEN_OUT")"
  printf '%s' "$TOKEN" > "$TUNNEL_TOKEN_OUT"
  chmod 600 "$TUNNEL_TOKEN_OUT"
  echo "wrote tunnel run token to TUNNEL_TOKEN_OUT (contents not logged)"
else
  echo "tunnel run token minted (not written; set TUNNEL_TOKEN_OUT to persist off-log)"
fi

unset TOKEN
echo "cf-bringup complete for ${TUNNEL_HOSTNAME} -> ${CNAME_TARGET}"
