#!/usr/bin/env bash
# Free billing-lock bypass: run the same autonomous release gate locally, then
# versions-upload + promote authichain-com with --keep-vars.
# Requires: gh auth, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env
# (or AUTHICHAIN_PRODUCTION_CLOUDFLARE_*), and Node 22+.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
EXPECTED_SHA=${1:-}
if [[ -z "$EXPECTED_SHA" ]]; then
  EXPECTED_SHA=$(git rev-parse origin/main 2>/dev/null || git rev-parse HEAD)
fi
[[ "$EXPECTED_SHA" =~ ^[[:xdigit:]]{40}$ ]]
export NODE_OPTIONS="${NODE_OPTIONS:---dns-result-order=ipv4first --no-network-family-autoselection}"
export GH_TOKEN=${GH_TOKEN:-$(gh auth token)}
export REPOSITORY=${REPOSITORY:-undone0603/authichain-unified}
export TARGET_SHA=$EXPECTED_SHA
export DISPATCH_SHA=$EXPECTED_SHA
# Prefer production env secret names when present; else CLOUDFLARE_*.
export CLOUDFLARE_API_TOKEN=${AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}
export CLOUDFLARE_ACCOUNT_ID=${AUTHICHAIN_PRODUCTION_CLOUDFLARE_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}
test -n "${CLOUDFLARE_API_TOKEN:-}"
test -n "${CLOUDFLARE_ACCOUNT_ID:-}"
echo "gate + publish for $EXPECTED_SHA"
node --test scripts/ci/autonomous-release-gate.test.mjs
node scripts/ci/autonomous-release-gate.mjs
git fetch origin main
test "$(git rev-parse origin/main)" = "$EXPECTED_SHA"
# Detached checkout of exact SHA for the Worker tree
WORKDIR=$(mktemp -d /tmp/ac-protected-publish.XXXXXX)
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT
git worktree add --detach "$WORKDIR" "$EXPECTED_SHA"
cd "$WORKDIR"
if [ -d /home/zac/projects/authichain-unified/node_modules ] && [ ! -e node_modules ]; then
  ln -s /home/zac/projects/authichain-unified/node_modules node_modules
fi
cd workers/authichain-com
npx --yes wrangler@4.149.0 versions upload --minify --keep-vars --config wrangler.toml \
  2>&1 | tee /tmp/ac-protected-version-upload.log
vid=$(node ../../scripts/ci/parse-wrangler-version-id.mjs /tmp/ac-protected-version-upload.log)
test -n "$vid"
node ../../scripts/ci/promote-worker-version.mjs authichain-com "$vid"
echo "promoted $vid"
for path in success dpp/thanks; do
  body=$(curl --fail --silent --show-error --max-time 25 "https://authichain.com/$path")
  grep -Eq 'No checkout reference provided|does not confirm payment' <<< "$body"
  if grep -Eq 'Payment received|Workspace opened|Your payment added' <<< "$body"; then
    echo "Unverified payment claim at /$path" >&2
    exit 1
  fi
done
echo "OK local protected publish $EXPECTED_SHA version $vid"
