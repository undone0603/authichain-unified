#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
export PATH="$(echo "$PATH"|tr ':' '\n'|grep -v /mnt/c/|paste -sd ':' -):$HOME/.nvm/versions/node/v22.22.3/bin"
cd "$(dirname "$0")/.." || exit 2

: "${GOOGLE_OAUTH_CLIENT_ID:?Set GOOGLE_OAUTH_CLIENT_ID in your shell env before running this script}"
: "${GOOGLE_OAUTH_CLIENT_SECRET:?Set GOOGLE_OAUTH_CLIENT_SECRET in your shell env before running this script}"
: "${OWNER_EMAILS:?Set OWNER_EMAILS in your shell env before running this script}"
CID="$GOOGLE_OAUTH_CLIENT_ID"
CSECRET="$GOOGLE_OAUTH_CLIENT_SECRET"
OWNERS="$OWNER_EMAILS"
JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")

F=.env.local
touch "$F"
# Replace empty JWT_SECRET, or append if absent
if grep -qE '^JWT_SECRET=' "$F"; then
  # portable in-place replace of the JWT_SECRET line
  node -e "const fs=require('fs');let s=fs.readFileSync('$F','utf8');s=s.replace(/^JWT_SECRET=.*$/m,'JWT_SECRET=\"$JWT\"');fs.writeFileSync('$F',s)"
else
  printf '\nJWT_SECRET="%s"\n' "$JWT" >> "$F"
fi
# Append Google vars if not present
grep -qE '^GOOGLE_CLIENT_ID=' "$F"     || printf 'GOOGLE_CLIENT_ID="%s"\n' "$CID" >> "$F"
grep -qE '^GOOGLE_CLIENT_SECRET=' "$F" || printf 'GOOGLE_CLIENT_SECRET="%s"\n' "$CSECRET" >> "$F"
grep -qE '^OWNER_EMAILS=' "$F"         || printf 'OWNER_EMAILS="%s"\n' "$OWNERS" >> "$F"

echo "=== .env.local auth vars (values masked) ==="
grep -E '^(JWT_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|OWNER_EMAILS)=' "$F" | sed -E 's/=("?.{0,10}).*/=\1…/'
echo "JWT_SECRET length: ${#JWT}"
