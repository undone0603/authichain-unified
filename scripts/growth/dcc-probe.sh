#!/usr/bin/env bash
# Temporary: learn the DCA iServices licence API shape. Removed before merge.
set -u
echo "id set: ${DCC_APP_ID:+yes} key set: ${DCC_APP_KEY:+yes}"
curl -sSL -m 30 https://iservices.dca.ca.gov/docs/search -o docs.html
echo "=== docs size $(wc -c < docs.html)"
grep -oE '(/api/search/v1/[A-Za-z0-9_/{}.?=&-]*|[a-zA-Z0-9_./-]*\.(json|ya?ml|js))' docs.html | sort -u | head -80
echo "=== cannabis mentions"
grep -oiE '.{120}cannabis.{120}' docs.html | head -10
for j in $(grep -oE 'src="[^"]+\.js"' docs.html | sed 's/src="//;s/"$//' | head -5); do
  case "$j" in http*) u="$j";; /*) u="https://iservices.dca.ca.gov$j";; *) u="https://iservices.dca.ca.gov/docs/$j";; esac
  echo "=== js $u"
  curl -sSL -m 30 "$u" | grep -oE '"/[a-zA-Z0-9_/{}-]*(license|search|board|type)[a-zA-Z0-9_/{}-]*"' | sort -u | head -40
done
for p in openapi.json swagger.json docs/search/openapi.json api/search/v1/openapi.json api/search/v1/swagger.json; do
  printf '=== %s -> ' "$p"
  curl -sS -m 20 -o spec.out -w '%{http_code} %{content_type}\n' "https://iservices.dca.ca.gov/$p"
  head -c 1500 spec.out; echo
done
for p in "" boards licenseTypes license/types; do
  printf '=== GET /api/search/v1/%s -> ' "$p"
  curl -sS -m 20 -o r.out -w '%{http_code}\n' -H "app_id: $DCC_APP_ID" -H "app_key: $DCC_APP_KEY" "https://iservices.dca.ca.gov/api/search/v1/$p"
  head -c 1200 r.out; echo
done
