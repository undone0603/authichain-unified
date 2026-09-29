#!/usr/bin/env bash
# Temporary: learn where DCC licence data can be read. Removed before merge.
set -u
H=https://search.cannabis.ca.gov
curl -sSL -m 30 $H/ -o i.html
echo "=== scripts"; grep -oE 'src="[^"]+"' i.html
for s in $(grep -oE 'src="[^"]*config[^"]*"' i.html | cut -d'"' -f2) /config.js; do echo "--- $s"; curl -sSL -m 20 "$H$s" | head -c 1500; echo; done
API=$(curl -sSL -m 20 $H/config.js | grep -oE 'CANNA_API[^,}]*' | grep -oE 'https?://[^"'"'"' ]+' | head -1)
echo "=== API=$API"
curl -sSL -m 30 https://search.cannabis.ca.gov/static/js/main.757d38fa.chunk.js -o m.js
echo "=== advanced params"; grep -oE '.{200}AdvancedSearch.{300}' m.js | head -2
grep -oE '"(licenseType|licenseStatus|issueDate|issuedDate|IssueDate|licenseTerm|businessStructure)[A-Za-z]*"' m.js | sort | uniq -c
if [ -n "$API" ]; then
  for q in "filteredSearch?searchQuery=cultivation&pageSize=3&pageNumber=1" "AdvancedSearch?licenseType=Cultivation&pageSize=3&pageNumber=1" "AdvancedSearch?pageSize=3&pageNumber=1&sortOrder=issueDate%20desc"; do
    echo "--- $q"; curl -sS -m 30 -w '\nHTTP %{http_code}\n' "$API/licenses/$q" | head -c 2500; echo
  done
  echo "--- licensetypes"; curl -sS -m 30 "$API/licensetypes" | head -c 1500; echo
  echo "--- licensestatuses"; curl -sS -m 30 "$API/licensestatuses" | head -c 800; echo
fi
