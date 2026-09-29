#!/usr/bin/env bash
# Temporary: learn the DCA iServices licence API shape. Removed before merge.
set -u
B=https://iservices.dca.ca.gov/api/search/v1
curl -sSL -m 30 https://iservices.dca.ca.gov/swagger/spec/search.json -o spec.json
node -e '
const s=JSON.parse(require("fs").readFileSync("spec.json","utf8"));
for (const p of ["/licenseSearchService/getPublicLicenseSearch","/commonSearchService/publicLicDelta"]) {
  const o=s.paths[p].post; console.log("===", p, JSON.stringify(o.requestBody).slice(0,1500));
}
console.log("=== components", JSON.stringify(s.components||s.definitions||{}).slice(0,4000));
'
for p in breezeDetailService/getAllBoards casDetailService/getAllBoards; do
  printf '=== %s -> ' "$p"
  curl -sS -m 30 -o r.out -w '%{http_code}\n' -H "APP_ID: $DCC_APP_ID" -H "APP_KEY: $DCC_APP_KEY" "$B/$p"
  head -c 300 r.out; echo
  echo "cannabis rows:"; grep -oiE '.{200}cannabis.{200}' r.out | head -5
done
printf '=== licenseTypes -> '
curl -sS -m 30 -o t.out -w '%{http_code}\n' -H "APP_ID: $DCC_APP_ID" -H "APP_KEY: $DCC_APP_KEY" "$B/breezeDetailService/getAllLicenseTypes"
grep -oiE '.{200}(cannabis|cultivat).{200}' t.out | head -8
