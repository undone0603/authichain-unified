#!/usr/bin/env bash
# Git Bash. Reads the real DATABASE_URL from .env and sets it as Vercel prod.
F="//wsl.localhost/Ubuntu/home/zac/projects/authichain-unified/.env"
CWD="//wsl.localhost/Ubuntu/home/zac/projects/authichain-unified"
VAL=$(grep -E "^DATABASE_URL=" "$F" | head -1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
if [ -z "$VAL" ]; then echo "NO_DATABASE_URL_IN_ENV"; exit 3; fi
# Sanity: confirm it's the aws-1 pooler host (masked echo)
echo "host check: $(echo "$VAL" | grep -oE '@[^/?\"]+' | sed -E 's#@.*pooler#@…pooler#')"
MSYS_NO_PATHCONV=1 vercel env rm DATABASE_URL production --yes --cwd "$CWD" >/dev/null 2>&1 || true
printf '%s' "$VAL" | MSYS_NO_PATHCONV=1 vercel env add DATABASE_URL production --cwd "$CWD" 2>&1 | grep -iE "added|error" | head -1
# Keep PGHOST/PGPORT consistent (some tooling reads them)
HOST=$(echo "$VAL" | grep -oE '@[^:/?]+' | sed 's/@//')
PORT=$(echo "$VAL" | grep -oE ':[0-9]+/' | grep -oE '[0-9]+')
echo "derived PGHOST=$HOST PGPORT=$PORT"
MSYS_NO_PATHCONV=1 vercel env rm PGHOST production --yes --cwd "$CWD" >/dev/null 2>&1 || true
printf '%s' "$HOST" | MSYS_NO_PATHCONV=1 vercel env add PGHOST production --cwd "$CWD" 2>&1 | grep -iE "added|error" | head -1
MSYS_NO_PATHCONV=1 vercel env rm PGPORT production --yes --cwd "$CWD" >/dev/null 2>&1 || true
printf '%s' "$PORT" | MSYS_NO_PATHCONV=1 vercel env add PGPORT production --cwd "$CWD" 2>&1 | grep -iE "added|error" | head -1
echo "done"
