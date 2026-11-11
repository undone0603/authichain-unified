#!/bin/bash
# Self-hosted WSL jobs must not run pnpm/action-setup for pnpm 10.28.2.
# That action downloads from registry.npmjs.org, times out, and then
# refuses the package signature (CI Main run 42616342706). The checkout's
# packageManager field is pnpm@10.28.2, and the runner shim prints that
# version when this script's working directory is the repo.
set -euo pipefail
node_bin="${HOME}/.nvm/versions/node/v22.23.4/bin"
test -x "${node_bin}/node"
pnpm_bin=""
for candidate in \
  "/home/zac/setup-pnpm-${RUNNER_NAME}/node_modules/.bin/pnpm" \
  "/home/zac/setup-pnpm-LAPTOP-72MAGTL2/node_modules/.bin/pnpm"
do
  if [ -x "$candidate" ]; then
    pnpm_bin="$candidate"
    break
  fi
done
test -n "$pnpm_bin"
test -f package.json
# The shim is #!/usr/bin/env node. This step's PATH does not include nvm
# until GITHUB_PATH is applied to the next step, so the version check
# needs Node on PATH now.
export PATH="${node_bin}:${PATH}"
echo "${node_bin}" >> "${GITHUB_PATH:?}"
echo "$(dirname "$pnpm_bin")" >> "$GITHUB_PATH"
"${node_bin}/node" -v | grep -q '^v22\.'
"$pnpm_bin" -v | grep -qx '10.28.2'
