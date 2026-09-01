#!/bin/bash
# Session runner: executes a repo command with node 22 + clean PATH (no /mnt/c).
export NVM_DIR=/home/zac/.nvm
. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '^/mnt/c' | paste -sd : -)"
cd "$(dirname "$0")/.." || exit 1
exec "$@"
