#!/bin/bash
cd "$(dirname "$0")/.."/docs/archive/cf-workers
for f in $(grep -lE 'eyJ[A-Za-z0-9_-]{20,}' *.js); do
  grep -ohE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$f" | sort -u | while IFS= read -r jwt; do
    payload=$(printf '%s' "$jwt" | cut -d. -f2 | tr -- '-_' '+/')
    pad=$(( (4 - ${#payload} % 4) % 4 ))
    i=0; while [ $i -lt $pad ]; do payload="${payload}="; i=$((i+1)); done
    role=$(printf '%s' "$payload" | base64 -d 2>/dev/null | grep -oE '"role" *: *"[a-z_]+"' || echo 'undecodable')
    echo "$f :: $role"
  done
done | sort -u
