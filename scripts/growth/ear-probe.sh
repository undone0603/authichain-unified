#!/usr/bin/env bash
# Temporary: learn how the stiftung ear battery register can be read. Removed before merge.
set -u
for u in https://www.ear-system.de/ear-verzeichnis/battghersteller https://www.ear-system.de/ear-verzeichnis/ https://www.stiftung-ear.de/de/service/verzeichnisse; do
  echo "=== $u"; curl -sSL -m 30 -A "Mozilla/5.0" -w '\nHTTP %{http_code} %{url_effective}\n' "$u" -o p.html; head -c 600 p.html; echo
  grep -oE '(src|href)="[^"]+\.(js|json|csv|xml)[^"]*"' p.html | head -20
done
curl -sSL -m 30 -A "Mozilla/5.0" https://www.ear-system.de/ear-verzeichnis/battghersteller -o b.html
for js in $(grep -oE 'src="[^"]+\.js"' b.html | cut -d'"' -f2); do
  case $js in http*) U=$js;; /*) U=https://www.ear-system.de$js;; *) U=https://www.ear-system.de/ear-verzeichnis/$js;; esac
  echo "--- $U"; curl -sSL -m 30 "$U" -o x.js; wc -c < x.js
  grep -oE '"(/|https?://)[^"]*(api|rest|verzeichnis|search|export|csv)[^"]*"' x.js | sort -u | head -30
done
