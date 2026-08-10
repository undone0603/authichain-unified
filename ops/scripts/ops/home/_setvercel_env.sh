#!/usr/bin/env bash
# Runs in Git Bash (Windows vercel CLI is authenticated there).
F="//wsl.localhost/Ubuntu/home/zac/authichain-unified/.env.local"
CWD="//wsl.localhost/Ubuntu/home/zac/authichain-unified"
getval(){ grep -E "^$1=" "$F" | head -1 | sed -E 's/^[^=]+=//; s/^"//; s/"$//'; }

for NAME in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET JWT_SECRET OWNER_EMAILS; do
  VAL=$(getval "$NAME")
  if [ -z "$VAL" ]; then echo "!! $NAME empty in .env.local, skipping"; continue; fi
  # Remove existing (ignore if absent), then add fresh for production.
  MSYS_NO_PATHCONV=1 vercel env rm "$NAME" production --yes --cwd "$CWD" >/dev/null 2>&1 || true
  printf '%s' "$VAL" | MSYS_NO_PATHCONV=1 vercel env add "$NAME" production --cwd "$CWD" 2>&1 | grep -iE "added|error|success" | head -1
done
echo "=== current production env var names ==="
MSYS_NO_PATHCONV=1 vercel env ls production --cwd "$CWD" 2>&1 | grep -iE "GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|JWT_SECRET|OWNER_EMAILS" | head
