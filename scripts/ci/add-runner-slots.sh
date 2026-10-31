#!/usr/bin/env bash
# scripts/ci/add-runner-slots.sh
#
# Adds self-hosted GitHub Actions runner slots on THIS machine so more CI jobs
# run at once. A runner process takes one job at a time, so each slot is one
# more parallel job. Run it inside the WSL distro that already hosts the
# authichain-ops runners, as the same user: the heavy-build lock
# (scripts/with-build-lock.sh) lives in $HOME/.cache and only serialises
# builds between runners that share that home. It cannot run from CI or a
# cloud session.
#
#   bash scripts/ci/add-runner-slots.sh --dry-run   # print the plan, change nothing
#   bash scripts/ci/add-runner-slots.sh             # ensure 2 slots, token via gh
#   SLOTS=3 RUNNER_TOKEN=XXXX bash scripts/ci/add-runner-slots.sh
#
# SLOTS is the number of extra slots this machine should have (default 2).
# Slots live in $HOME/actions-runner-slot-<n>. A slot that is already
# configured is skipped, so re-running with the same SLOTS changes nothing.
#
# RUNNER_TOKEN is the registration token from Settings -> Actions -> Runners ->
# New self-hosted runner (valid one hour). With an authenticated `gh` the
# script fetches it itself. One token registers every slot in this run.
#
# Labels: new slots get authichain-ops only (GitHub adds self-hosted, Linux,
# ARM64). CI jobs ask for authichain-ops. Deploy workflows ask for
# authichain-wsl, so deploys stay on the existing deploy runner, one at a time.
#
# Toolchain: config.sh records this shell's PATH for the runner. Run it from a
# shell where node and pnpm resolve, because self-hosted jobs use the runner's
# own pnpm once the action-setup skip (#2165, #2167) lands.
#
# Capacity guard: stops when (configured runners + new slots) x GB_PER_SLOT
# is more than this machine's memory. next build needs a 4 GB heap.
# FORCE=1 overrides.
#
# The download is checked against the SHA-256 that actions/runner publishes in
# its release notes. A missing or wrong hash stops the script.
# ALLOW_UNVERIFIED=1 overrides; use it only after checking the file yourself.
#
# Remove a slot (systemd):
#   cd ~/actions-runner-slot-N && sudo ./svc.sh stop && sudo ./svc.sh uninstall
#   ./config.sh remove --token <token from Settings -> Actions -> Runners>
set -euo pipefail

REPO="${RUNNER_REPO:-undone0603/authichain-unified}"
SLOTS="${SLOTS:-2}"
BASE_DIR="${RUNNER_BASE_DIR:-$HOME}"
NAME_PREFIX="${RUNNER_NAME_PREFIX:-$(hostname -s)-slot}"
LABELS="${RUNNER_LABELS:-authichain-ops}"
GB_PER_SLOT="${GB_PER_SLOT:-4}"
RELEASE_API="${RUNNER_RELEASE_API:-https://api.github.com/repos/actions/runner/releases/latest}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h | --help)
      sed -n '2,/^set -euo pipefail$/p' "$0" | sed '$d; s/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf 'unknown argument: %s (try --help)\n' "$arg" >&2
      exit 2
      ;;
  esac
done

say() { printf '\n== %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ "$SLOTS" =~ ^[1-9][0-9]*$ ]] || die "SLOTS must be a positive integer (got '$SLOTS')"
[[ "$GB_PER_SLOT" =~ ^[1-9][0-9]*$ ]] || die "GB_PER_SLOT must be a positive integer (got '$GB_PER_SLOT')"
[ "$(uname -s)" = Linux ] || die "Linux/WSL only; the existing runners are Linux ARM64"
for bin in curl tar sha256sum python3; do
  command -v "$bin" >/dev/null || die "$bin is required"
done
command -v flock >/dev/null || warn "flock is missing; scripts/with-build-lock.sh needs it on this machine"

case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) die "unsupported CPU $(uname -m)" ;;
esac

say "1/5 Check this machine"
if [ "$HOME" != /home/zac ]; then
  warn "workflows hard-code /home/zac paths (pnpm dest, Playwright, turbo cache); HOME is $HOME"
fi
for bin in node pnpm git; do
  if command -v "$bin" >/dev/null; then
    printf '  %-5s %s\n' "$bin" "$("$bin" --version 2>/dev/null | head -n1)"
  else
    warn "$bin is not on PATH; runners registered from this shell will not find it"
  fi
done
configured=$(find "$BASE_DIR" -maxdepth 2 -name .runner -path '*actions-runner*' 2>/dev/null | wc -l | tr -d ' ')
mem_gb=$(awk '/^MemTotal:/ {printf "%d", $2 / 1048576}' /proc/meminfo)
cores=$(nproc)
printf '  runners configured under %s: %s\n' "$BASE_DIR" "$configured"
printf '  memory %s GB, %s cores, arch %s\n' "$mem_gb" "$cores" "$arch"
if [ "$configured" -eq 0 ]; then
  warn "found no configured runner under $BASE_DIR; set RUNNER_BASE_DIR if the existing runners live elsewhere, or the capacity check undercounts"
fi

say "2/5 Plan"
todo_dirs=()
todo_names=()
for k in $(seq 1 "$SLOTS"); do
  dir="$BASE_DIR/actions-runner-slot-$k"
  if [ -f "$dir/.runner" ]; then
    printf '  slot %s: already configured in %s\n' "$k" "$dir"
  else
    todo_dirs+=("$dir")
    todo_names+=("$NAME_PREFIX-$k")
    printf '  slot %s: register %s in %s (labels: %s)\n' "$k" "$NAME_PREFIX-$k" "$dir" "$LABELS"
  fi
done
if [ "${#todo_dirs[@]}" -eq 0 ]; then
  say "Nothing to do: all $SLOTS slots are configured."
  exit 0
fi
total=$((configured + ${#todo_dirs[@]}))
need_gb=$((total * GB_PER_SLOT))
printf '  after this run: %s runners, about %s GB at %s GB each\n' "$total" "$need_gb" "$GB_PER_SLOT"
if [ "$need_gb" -gt "$mem_gb" ]; then
  if [ "${FORCE:-0}" = 1 ]; then
    warn "FORCE=1: continuing with $total runners on $mem_gb GB"
  else
    die "not enough memory for $total runners at $GB_PER_SLOT GB each (have $mem_gb GB). Lower SLOTS, give WSL more memory in %UserProfile%\\.wslconfig, or set FORCE=1."
  fi
fi
if [ "$total" -gt "$cores" ]; then
  warn "$total runners on $cores cores; jobs will compete for CPU"
fi
if [ "$DRY_RUN" = 1 ]; then
  say "Dry run: nothing changed."
  exit 0
fi

say "3/5 Registration token"
token="${RUNNER_TOKEN:-}"
if [ -z "$token" ] && command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  token=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)
fi
[ -n "$token" ] || die "no token. Set RUNNER_TOKEN from Settings -> Actions -> Runners -> New self-hosted runner, or log in with gh as a repo admin."
echo "  token ready (not printed)"

say "4/5 Download the runner (linux-$arch)"
release=$(curl -fsSL "$RELEASE_API") || die "could not read the latest runner release"
read -r version want < <(printf '%s' "$release" | python3 -c '
import json, re, sys
rel = json.load(sys.stdin)
arch = sys.argv[1]
version = (rel.get("tag_name") or "").lstrip("v")
m = re.search(r"BEGIN SHA linux-%s -->\s*([0-9a-f]{64})" % re.escape(arch), rel.get("body") or "")
print(version or "-", m.group(1) if m else "-")
' "$arch") || die "could not parse the runner release"
[ "$version" != - ] || die "could not read the runner version"
[ "$want" != - ] || want=""
asset="actions-runner-linux-$arch-$version.tar.gz"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/actions-runner"
tarball="$cache/$asset"
mkdir -p "$cache"
if [ ! -f "$tarball" ]; then
  curl -fsSL -o "$tarball.part" "https://github.com/actions/runner/releases/download/v$version/$asset"
  mv "$tarball.part" "$tarball"
fi
got=$(sha256sum "$tarball" | cut -d' ' -f1)
if [ -n "$want" ] && [ "$got" = "$want" ]; then
  echo "  $asset sha256 ok"
elif [ "${ALLOW_UNVERIFIED:-0}" = 1 ]; then
  warn "ALLOW_UNVERIFIED=1: $asset not verified (published ${want:-none}, got $got)"
else
  rm -f "$tarball"
  die "$asset sha256 does not match the release notes (published ${want:-none}, got $got)"
fi

say "5/5 Register and start ${#todo_dirs[@]} slot(s)"
use_systemd=0
if [ "$(ps -p 1 -o comm= 2>/dev/null)" = systemd ]; then
  use_systemd=1
else
  warn "systemd is not PID 1, so slots run in the background and stop when WSL shuts down. To keep them: add '[boot] systemd=true' to /etc/wsl.conf, run 'wsl --shutdown' from Windows, then in each slot directory run 'sudo ./svc.sh install \$(id -un) && sudo ./svc.sh start'."
fi
for i in "${!todo_dirs[@]}"; do
  dir="${todo_dirs[$i]}"
  name="${todo_names[$i]}"
  mkdir -p "$dir"
  tar xzf "$tarball" -C "$dir"
  (
    cd "$dir"
    ./config.sh --unattended --replace \
      --url "https://github.com/$REPO" \
      --token "$token" \
      --name "$name" \
      --labels "$LABELS" \
      --work _work
    if [ "$use_systemd" = 1 ]; then
      sudo ./svc.sh install "$(id -un)"
      sudo ./svc.sh start
    else
      nohup ./run.sh >>run.log 2>&1 &
      echo "  $name started in the background (log: $dir/run.log)"
    fi
  )
  echo "  $name registered"
done

say "Done"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh api "repos/$REPO/actions/runners" \
    --jq '.runners[] | "  \(.name)  \(.status)  busy=\(.busy)  \([.labels[].name] | join(","))"' || true
fi
cat <<'EOF'

Next:
  1. Settings -> Actions -> Runners should list the new slots as Idle within a minute.
  2. Keep "Require approval for all external contributors" under Settings -> Actions ->
     General. The repo is public; a fork PR could otherwise target these labels.
  3. Next builds still run one at a time (heavy-build lock), so the extra slots mostly
     speed up lint, typecheck, tests and the small workflows.
EOF
