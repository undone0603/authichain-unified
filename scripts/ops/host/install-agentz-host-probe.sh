#!/bin/bash
# Owner-run installer for the restricted AgentZ host diagnostic authority.
#
# Grants RUNNER_USER passwordless sudo for exactly /usr/local/sbin/agentz-host-probe,
# which only runs a root-owned copy of scripts/ops/agentz_live_executable_probe.py
# pinned by sha256. Run as root from a clean checkout of protected main:
#
#   sudo scripts/ops/host/install-agentz-host-probe.sh [RUNNER_USER]     # default: zac
#   sudo scripts/ops/host/install-agentz-host-probe.sh --uninstall
#
# Re-run after any change to the probe; until then the wrapper refuses to run (HOLD).
set -euo pipefail
umask 022

WRAPPER=/usr/local/sbin/agentz-host-probe
PROBE_DIR=/usr/local/libexec/agentz
PROBE=$PROBE_DIR/agentz_live_executable_probe.py
SUDOERS=/etc/sudoers.d/agentz-host-probe
here="$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"

[ "$(id -u)" = 0 ] || { echo 'install-agentz-host-probe: run as root' >&2; exit 2; }

if [ "${1:-}" = --uninstall ]; then
  rm -f -- "$SUDOERS" "$WRAPPER" "$PROBE"
  rmdir -- "$PROBE_DIR" 2>/dev/null || true
  echo 'agentz-host-probe authority removed'
  exit 0
fi

runner_user=${1:-zac}
[[ "$runner_user" =~ ^[a-z_][a-z0-9_-]*$ ]] && id -u "$runner_user" >/dev/null ||
  { echo "install-agentz-host-probe: unknown user $runner_user" >&2; exit 2; }
[ "$runner_user" != root ] || { echo 'install-agentz-host-probe: runner user must not be root' >&2; exit 2; }

# Only install from a clean checkout so the pinned hash is a reviewed main blob.
src=$repo/scripts/ops/agentz_live_executable_probe.py
[ -f "$src" ] && [ ! -L "$src" ] || { echo "install-agentz-host-probe: missing $src" >&2; exit 2; }
if [ -z "${AGENTZ_PROBE_ALLOW_DIRTY:-}" ]; then
  git -c safe.directory="$repo" -C "$repo" diff --quiet HEAD -- scripts/ops/agentz_live_executable_probe.py scripts/ops/host ||
    { echo 'install-agentz-host-probe: probe or wrapper differs from HEAD' >&2; exit 2; }
fi
probe_sha="$(sha256sum "$src" | cut -d ' ' -f 1)"
/usr/bin/python3 -B -I -c 'import ast,sys; ast.parse(open(sys.argv[1]).read())' "$src"

install -d -o root -g root -m 0755 "$PROBE_DIR"
install -o root -g root -m 0644 "$src" "$PROBE"
tmp="$(mktemp)"
trap 'rm -f -- "$tmp"' EXIT
sed "s/@PROBE_SHA256@/$probe_sha/" "$here/agentz-host-probe" > "$tmp"
install -o root -g root -m 0755 "$tmp" "$WRAPPER"

cat > "$tmp" <<EOF
# Restricted diagnostic authority for the protected AgentZ host comparison workflow.
# Managed by scripts/ops/host/install-agentz-host-probe.sh; remove with --uninstall.
Defaults!$WRAPPER env_reset
$runner_user ALL=(root) NOPASSWD: $WRAPPER --self-check, $WRAPPER --baseline, $WRAPPER --compare *
EOF
visudo -cf "$tmp" >/dev/null
install -o root -g root -m 0440 "$tmp" "$SUDOERS"
visudo -c >/dev/null

printf 'RUNNER_USER=%s\nINSTALLED_PROBE_SHA256=%s\n' "$runner_user" "$probe_sha"
sudo -n -u "$runner_user" sudo -n "$WRAPPER" --self-check
