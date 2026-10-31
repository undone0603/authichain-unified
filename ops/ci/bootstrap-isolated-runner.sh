#!/usr/bin/env bash
# Provision a NEW, disposable ARM64 Linux CI host, never the publishing host.
# Requires a one-time registration token from repository Settings > Actions > Runners.
# Do not run on wsl-zac-arm64 or a machine holding Stripe/Cloudflare production credentials.
set -euo pipefail
REPO_URL="https://github.com/undone0603/authichain-unified"
RUNNER_NAME="${CI_RUNNER_NAME:-authichain-ci-arm64-01}"
RUNNER_LABEL="authichain-ci-isolated"
VERSION="2.338.2"
SHA256_ARM64="670adb2f268fe21dcbb58b3db0e0aa9d5b3bddfe2c651481336e561ff86de945"
ARCHIVE="actions-runner-linux-arm64-${VERSION}.tar.gz"
INSTALL_DIR="${CI_RUNNER_DIR:-$HOME/actions-runner-authichain-ci}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$(uname -s)" == Linux ]] || fail "Linux VM required."
[[ "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]] || fail "Dedicated ARM64 Linux VM required."
[[ "$EUID" -ne 0 ]] || fail "Run as the unprivileged dedicated CI user, not root."
[[ "${CONFIRM_ISOLATED_CI_HOST:-}" == "YES" ]] || fail "Set CONFIRM_ISOLATED_CI_HOST=YES only after confirming this is a SEPARATE host/VM from the production publisher."
[[ -d /run/systemd/system ]] || fail "systemd service manager required. Use a dedicated Linux VM, not a non-systemd WSL session."
if pgrep -x 'Runner.Listener' >/dev/null; then
  fail "Another GitHub runner listener exists on this host. Do not combine CI with publishing."
fi
if systemctl list-unit-files --type=service 'actions.runner.*' --no-legend 2>/dev/null | grep -q 'actions.runner.'; then
  fail "A GitHub runner service is already registered on this host."
fi
[[ ! -e "$HOME/.wrangler" && ! -e "$HOME/.config/wrangler" ]] || fail "Wrangler credentials detected. Use a clean CI VM/user."
for cmd in curl tar sha256sum node npm sudo; do
  command -v "$cmd" >/dev/null || fail "Install prerequisite: $cmd"
done
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( NODE_MAJOR >= 22 )) || fail "Install Node.js 22 or later as the VM default before registering."
[[ ! -e "$INSTALL_DIR/.runner" ]] || fail "Existing runner registration found; inspect/recover it instead of overwriting."
mkdir -p "$INSTALL_DIR"
chmod 700 "$INSTALL_DIR"
cd "$INSTALL_DIR"
if [[ ! -f ./config.sh ]]; then
  curl --fail --location --retry 3 --silent --show-error \
    "https://github.com/actions/runner/releases/download/v${VERSION}/${ARCHIVE}" -o "$ARCHIVE"
  echo "${SHA256_ARM64}  ${ARCHIVE}" | sha256sum --check --status || fail "Runner download checksum mismatch."
  tar -xzf "$ARCHIVE"
  rm -f "$ARCHIVE"
fi
# CI Main uses this preinstalled pinned pnpm path on self-hosted runners.
npm install --prefix "$HOME/setup-pnpm-${RUNNER_NAME}" --no-audit --no-fund pnpm@10.28.2
[[ -x "$HOME/setup-pnpm-${RUNNER_NAME}/node_modules/.bin/pnpm" ]] || fail "Pinned pnpm installation missing."
printf 'Runner registration: %s (%s)\n' "$RUNNER_NAME" "$RUNNER_LABEL"
printf 'Generate a new one-time registration token at %s/settings/actions/runners/new\n' "$REPO_URL"
read -r -s -p "Paste runner registration token (not echoed): " RUNNER_REGISTRATION_TOKEN
printf '\n'
[[ -n "$RUNNER_REGISTRATION_TOKEN" ]] || fail "Registration token missing."
./config.sh --unattended --url "$REPO_URL" \
  --token "$RUNNER_REGISTRATION_TOKEN" --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABEL" --work "_work"
unset RUNNER_REGISTRATION_TOKEN
sudo ./svc.sh install "$(id -un)"
sudo ./svc.sh start
sudo ./svc.sh status
printf '\nRegistered isolated CI runner. Verify it is Idle in GitHub and run the CI-only smoke workflow.\n'
