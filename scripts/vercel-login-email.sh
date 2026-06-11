#!/usr/bin/env bash
set -u
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1
cd /home/zac/authichain-unified
vercel login undone.k@gmail.com 2>&1
echo "exit: $?"
vercel whoami 2>&1
