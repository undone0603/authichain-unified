#!/usr/bin/env bash
# Temporary: learn where DCC licence data can be read. Removed before merge.
set -u
curl -sSL -m 30 https://search.cannabis.ca.gov/static/js/main.757d38fa.chunk.js -o m.js
echo "=== bases"; grep -oE '"https?://[^"]*"|baseURL:[^,]{0,120}|REACT_APP_[A-Z_]+' m.js | sort -u | head -30
echo "=== around /licenses/"; grep -oE '.{250}"/licenses/".{250}' m.js | head -3
echo "=== around filtered"; grep -oE '.{200}(filtered|Search\?|pageSize|pageNumber).{200}' m.js | head -4
