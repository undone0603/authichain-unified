#!/usr/bin/env bash
# Temporary: learn where DCC licence data can be read. Removed before merge.
set -u
curl -sSL -m 30 https://search.cannabis.ca.gov/ -o s.html
echo "=== html size $(wc -c < s.html)"
grep -oE '(src|href)="[^"]+\.js[^"]*"' s.html | head -10
for j in $(grep -oE 'src="[^"]+\.js[^"]*"' s.html | sed 's/src="//;s/"$//' | head -6); do
  case "$j" in http*) u="$j";; /*) u="https://search.cannabis.ca.gov$j";; *) u="https://search.cannabis.ca.gov/$j";; esac
  echo "=== js $u"
  curl -sSL -m 30 "$u" -o b.js
  grep -oE 'https?://[a-zA-Z0-9._/-]+' b.js | grep -viE 'w3\.org|reactjs|github|mozilla|googleapis|google|fb\.me|jquery|bootstrap' | sort -u | head -20
  grep -oE '"/[a-zA-Z0-9_/-]*(licen|search|export|download)[a-zA-Z0-9_/?=&-]*"' b.js | sort -u | head -20
done
