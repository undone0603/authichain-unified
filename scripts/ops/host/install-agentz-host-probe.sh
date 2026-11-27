#!/bin/bash
# Owner-run installer for the restricted AgentZ host diagnostic authority.
#
# Grants RUNNER_USER passwordless sudo for exactly /usr/local/sbin/agentz-host-probe,
# which only runs a root-owned copy of scripts/ops/agentz_live_executable_probe.py
# pinned by sha256. Run as root from a checkout whose probe and wrapper match
# the local origin/main ref (fetch first):
#
#   sudo scripts/ops/host/install-agentz-host-probe.sh [RUNNER_USER]     # default: zac
#   sudo scripts/ops/host/install-agentz-host-probe.sh --uninstall
#
# Re-run after any change to the probe or wrapper on main; until then the
# protected workflow stops with HOLD.
set -euo pipefail
umask 022

WRAPPER=/usr/local/sbin/agentz-host-probe
PROBE_DIR=/usr/local/libexec/agentz
PROBE=$PROBE_DIR/agentz_live_executable_probe.py
SUDOERS=/etc/sudoers.d/agentz-host-probe
here="$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"

[ "$(id -u)" = 0 ] || { echo 'install-agentz-host-probe: run as root' >&2; exit 2; }

uninstall() {
  rm -f -- "$SUDOERS" "$WRAPPER" "$PROBE"
  rmdir -- "$PROBE_DIR" 2>/dev/null || true
}

if [ "${1:-}" = --uninstall ]; then
  uninstall
  echo 'agentz-host-probe authority removed'
  exit 0
fi

runner_user=${1:-zac}
[[ "$runner_user" =~ ^[a-z_][a-z0-9_-]*$ ]] && id -u "$runner_user" >/dev/null ||
  { echo "install-agentz-host-probe: unknown user $runner_user" >&2; exit 2; }
[ "$runner_user" != root ] || { echo 'install-agentz-host-probe: runner user must not be root' >&2; exit 2; }
runner_home="$(getent passwd "$runner_user" | cut -d: -f6)"
[[ "$runner_home" =~ ^/home/[a-z_][a-z0-9_-]*$ ]] ||
  { echo "install-agentz-host-probe: unexpected home $runner_home" >&2; exit 2; }

# Only install reviewed bytes: the probe and wrapper must match origin/main.
src=$repo/scripts/ops/agentz_live_executable_probe.py
wrapper_src=$here/agentz-host-probe
for f in "$src" "$wrapper_src"; do
  [ -f "$f" ] && [ ! -L "$f" ] || { echo "install-agentz-host-probe: missing $f" >&2; exit 2; }
done
git -c safe.directory="$repo" -C "$repo" diff --quiet origin/main -- \
    scripts/ops/agentz_live_executable_probe.py scripts/ops/host/agentz-host-probe ||
  { echo 'install-agentz-host-probe: probe or wrapper differs from origin/main (fetch, then use a main worktree)' >&2; exit 2; }
probe_sha="$(sha256sum "$src" | cut -d ' ' -f 1)"
wrapper_sha="$(sha256sum "$wrapper_src" | cut -d ' ' -f 1)"
/usr/bin/python3 -B -I -c 'import ast,sys; ast.parse(open(sys.argv[1]).read())' "$src"

# Build and validate everything before touching the system.
stage="$(mktemp -d)"
installed=0
cleanup() {
  rm -rf -- "$stage"
  if [ "$installed" = 1 ]; then
    echo 'install-agentz-host-probe: failed; rolling back' >&2
    uninstall
  fi
}
trap cleanup EXIT
sed -e "s/@PROBE_SHA256@/$probe_sha/" -e "s/@WRAPPER_SOURCE_SHA256@/$wrapper_sha/" \
    -e "s|@RUNNER_HOME@|$runner_home|" "$wrapper_src" > "$stage/wrapper"
bash -n "$stage/wrapper"
cat > "$stage/sudoers" <<EOF
# Restricted diagnostic authority for the protected AgentZ host comparison workflow.
# Managed by scripts/ops/host/install-agentz-host-probe.sh; remove with --uninstall.
Defaults!$WRAPPER env_reset, !requiretty
$runner_user ALL=(root) NOPASSWD: $WRAPPER --self-check, $WRAPPER --baseline, $WRAPPER --compare *
EOF
visudo -cf "$stage/sudoers" >/dev/null

installed=1
install -d -o root -g root -m 0755 "$PROBE_DIR"
install -o root -g root -m 0644 "$src" "$PROBE"
install -o root -g root -m 0755 "$stage/wrapper" "$WRAPPER"
install -o root -g root -m 0440 "$stage/sudoers" "$SUDOERS"
visudo -c >/dev/null
self_check="$(sudo -n -u "$runner_user" sudo -n "$WRAPPER" --self-check)"
grep -qx 'PROBE_UID=0' <<< "$self_check"

# The grant only means something if it is the runner's sole passwordless root path.
broader="$(sudo -n -l -U "$runner_user" | grep NOPASSWD | grep -v -F "$WRAPPER" || true)"
[ -z "$broader" ] || { echo "install-agentz-host-probe: $runner_user has other NOPASSWD grants:" >&2; echo "$broader" >&2; exit 1; }
installed=0

printf 'RUNNER_USER=%s\n%s\n' "$runner_user" "$self_check"
if id -nG "$runner_user" | tr ' ' '\n' | grep -qx docker; then
  echo "WARNING: $runner_user is in the docker group, which is root-equivalent; this grant does not restrict it."
fi
