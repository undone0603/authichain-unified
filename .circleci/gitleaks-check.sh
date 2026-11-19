#!/usr/bin/env bash
# Port the GitHub Actions PR/push tree-only gitleaks scan into CircleCI.
# No tokens, contexts, historical scan, or publishing. GitHub-published SHA-256 pins.
set -euo pipefail

version=8.28.0
case "$(uname -m)" in
  x86_64) artifact="gitleaks_8.28.0_linux_x64.tar.gz"
          digest="a65b5253807a68ac0cafa4414031fd740aeb55f54fb7e55f386acb52e6a840eb" ;;
  aarch64) artifact="gitleaks_8.28.0_linux_arm64.tar.gz"
           digest="eff65261156100e5d94a6b3dec313d532fddfe19ae1590bf7a2b4f2699128356" ;;
  *) echo "Unsupported gitleaks architecture" >&2; exit 2 ;;
esac

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
curl --fail --silent --show-error --location --retry 1 --connect-timeout 10 --max-time 60 \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${artifact}" \
  --output "$tmp/gitleaks.tar.gz"
printf '%s  %s\n' "$digest" "$tmp/gitleaks.tar.gz" | sha256sum --check --status
tar --no-same-owner -xzf "$tmp/gitleaks.tar.gz" -C "$tmp" gitleaks
# Scan only git-tracked files (working-tree content), so installed dependencies
# (node_modules/, build output, caches) are never scanned. This job installs
# dependencies before quality runs; next 16.4.5's compiled runtime matched the
# resend-key rule (#2585). A committed node_modules/ would still be tracked and
# therefore still scanned. Paths stay relative, so .gitleaksignore keeps working.
tree="$tmp/tree"
mkdir -p "$tree"
git ls-files -z | tar --null --no-recursion -T - -cf - | tar --no-same-owner -xf - -C "$tree"
cfg="$(pwd)/.gitleaks.toml"
ignore="$(pwd)/.gitleaksignore"
(cd "$tree" && "$tmp/gitleaks" detect --no-git --source . --config "$cfg" \
  --gitleaks-ignore-path "$ignore" --redact --verbose)
