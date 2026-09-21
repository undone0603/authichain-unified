#!/usr/bin/env bash
# Upload content/microsites packs to MICROSITES_KV (root worker binding).
# Does not enable Workers Paid, create DNS, or invent Stripe prices.
#
# Prerequisites:
#   CLOUDFLARE_API_TOKEN with Workers KV Storage:Edit
#   CLOUDFLARE_ACCOUNT_ID
#
# Keys (see content/microsites/manifest.json):
#   mendo/index.html
#   realthcv/index.html          (same bytes as mendo)
#   trumark/index.html
#   musa/index.html
#   made-in-america/index.html   (same bytes as musa)
#   strainchain/index.html
#
# Live serving today is authichain-com /m/<slug>. KV + *.authichain.com
# only works after the root `authichain` worker is actually routed to
# those hostnames (currently 522/523). This script is the upload half.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/content/microsites/manifest.json"
NAMESPACE_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).namespaceId)")"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required (Workers KV Storage:Edit). Not uploading."
  echo "Live path after authichain-com deploy: https://authichain.com/m/mendo"
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required."
  exit 1
fi

put_key() {
  local key="$1"
  local file="$2"
  echo "PUT $key <- $file"
  npx wrangler kv key put "$key" --path "$file" --namespace-id "$NAMESPACE_ID"
}

put_key "mendo/index.html" "$ROOT/content/microsites/mendo/index.html"
put_key "realthcv/index.html" "$ROOT/content/microsites/mendo/index.html"
put_key "trumark/index.html" "$ROOT/content/microsites/trumark/index.html"
put_key "musa/index.html" "$ROOT/content/microsites/musa/index.html"
put_key "made-in-america/index.html" "$ROOT/content/microsites/musa/index.html"
put_key "strainchain/index.html" "$ROOT/content/microsites/strainchain/index.html"

echo "KV upload complete. Subdomain DNS is still 522/523 until a worker route is attached."
echo "Apex URLs (no DNS change): https://authichain.com/m/mendo"
