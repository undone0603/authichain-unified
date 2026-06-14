#!/usr/bin/env bash
# Which mail-related env var NAMES exist in Vercel production? Names only.
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/zac/authichain-unified
vercel env ls production 2>&1 | grep -iE 'GMAIL|SENDGRID|RESEND|SMTP|MAIL' || echo "NO mail-related env vars in production"
