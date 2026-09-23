#!/usr/bin/env bash
# scripts/gemma/setup-runner.sh
#
# Registers the self-hosted GitHub Actions runner that gemma-loops.yml needs.
# Run it ON the machine inside the owner's network that can reach LM Studio
# (Linux or macOS). It cannot be run from CI or a cloud session.
#
#   bash scripts/gemma/setup-runner.sh            # uses `gh` for the token
#   RUNNER_TOKEN=XXXX bash scripts/gemma/setup-runner.sh
#
# The token is the one shown under Settings -> Actions -> Runners ->
# New self-hosted runner (valid one hour). With an authenticated `gh` the
# script fetches it itself.
#
# Steps: 1) check LM Studio answers, 2) download the runner, 3) register it
# with the label `lan-gemma`, 4) install it as a service. Re-running is safe:
# an already-configured runner is left alone.
#
# Charter: docs/OPERATING_CHARTER.md ("Gemma (local model)").
set -euo pipefail

REPO="${GEMMA_REPO:-undone0603/authichain-unified}"
LLM_URL="${LOCAL_LLM_URL:-http://192.168.254.10:1234}"
LLM_URL="${LLM_URL%/}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner-gemma}"
RUNNER_NAME="${RUNNER_NAME:-lan-gemma-$(hostname -s)}"
LABEL="lan-gemma"

say() { printf '\n== %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

for bin in curl tar; do command -v "$bin" >/dev/null || die "$bin is required"; done

say "1/4 LM Studio at $LLM_URL"
if models=$(curl -fsS --max-time 10 "$LLM_URL/v1/models"); then
  echo "$models" | head -c 600; echo
else
  die "LM Studio did not answer at $LLM_URL/v1/models. Start its server (Developer tab -> Start) and allow LAN access, or set LOCAL_LLM_URL."
fi

if [ -f "$RUNNER_DIR/.runner" ]; then
  say "Runner already configured in $RUNNER_DIR; nothing to register."
  echo "To re-register: cd $RUNNER_DIR && ./config.sh remove, then run this again."
  exit 0
fi

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=osx ;;
  *) die "unsupported OS $(uname -s); use the GitHub UI instructions instead" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) die "unsupported CPU $(uname -m)" ;;
esac

say "2/4 Download runner ($os-$arch)"
version=$(curl -fsS https://api.github.com/repos/actions/runner/releases/latest |
  sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p' | head -n1)
[ -n "$version" ] || die "could not read the latest runner version"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
tarball="actions-runner-$os-$arch-$version.tar.gz"
curl -fsSL -o "$tarball" "https://github.com/actions/runner/releases/download/v$version/$tarball"
tar xzf "$tarball"
rm -f "$tarball"

say "3/4 Register with $REPO as $RUNNER_NAME (label $LABEL)"
token="${RUNNER_TOKEN:-}"
if [ -z "$token" ] && command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  token=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)
fi
[ -n "$token" ] || die "no token. Set RUNNER_TOKEN from Settings -> Actions -> Runners -> New self-hosted runner, or log in with gh."
./config.sh --unattended --replace \
  --url "https://github.com/$REPO" \
  --token "$token" \
  --name "$RUNNER_NAME" \
  --labels "$LABEL" \
  --work _work

say "4/4 Install as a service"
if [ "$os" = linux ]; then
  sudo ./svc.sh install "$(id -un)"
  sudo ./svc.sh start
else
  ./svc.sh install
  ./svc.sh start
fi

cat <<EOF

Runner registered. Next:
  1. Settings -> Actions -> General -> "Fork pull request workflows from outside
     collaborators": choose "Require approval for all external contributors".
     The repo is public; a fork PR could otherwise name this runner's labels in
     its own workflow and run code inside your network.
  2. If LM Studio is not at the default, set repo variables LOCAL_LLM_URL / LOCAL_LLM_MODEL.
  3. Actions -> "Gemma loops" -> Run workflow with dry_run checked; read the output.
  4. Set "gemma-loops.yml": "on" in .github/autonomy.json and merge.
EOF
