#!/usr/bin/env bash
# User-space PostgreSQL server for catalog grant two-connection tests.
# No sudo: the self-hosted WSL runner rejects passwordless apt.
# Never connects to a hosted database.
set -euo pipefail

PG_VERSION="${AUTHICHAIN_PG_VERSION:-16.6.0}"

have_server() {
  local dir="${1:-}"
  [[ -n "$dir" && -x "$dir/initdb" && -x "$dir/postgres" ]]
}

export_bindir() {
  local dir="$1"
  echo "pg_bindir=$dir"
  echo "pg_version=$("$dir/postgres" --version)"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "PG_BINDIR=$dir" >>"$GITHUB_ENV"
  fi
  if [[ -n "${GITHUB_PATH:-}" ]]; then
    echo "$dir" >>"$GITHUB_PATH"
  fi
}

if have_server "${PG_BINDIR:-}"; then
  export_bindir "$PG_BINDIR"
  exit 0
fi

if command -v pg_config >/dev/null 2>&1; then
  dir="$(pg_config --bindir 2>/dev/null || true)"
  if have_server "$dir"; then
    export_bindir "$dir"
    exit 0
  fi
fi

for dir in \
  /usr/lib/postgresql/16/bin \
  /usr/lib/postgresql/15/bin \
  /usr/pgsql-16/bin; do
  if have_server "$dir"; then
    export_bindir "$dir"
    exit 0
  fi
done

machine="$(uname -m)"
case "$machine" in
  x86_64 | amd64) triple="x86_64-unknown-linux-gnu" ;;
  aarch64 | arm64) triple="aarch64-unknown-linux-gnu" ;;
  *)
    echo "unsupported architecture: $machine" >&2
    exit 1
    ;;
esac

cache="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/authichain-pg-${PG_VERSION}-${triple}"
mkdir -p "$cache"
tarball="$cache/server.tar.gz"
url="https://github.com/theseus-rs/postgresql-binaries/releases/download/${PG_VERSION}/postgresql-${PG_VERSION}-${triple}.tar.gz"

if [[ ! -s "$tarball" ]]; then
  echo "downloading user-space PostgreSQL ${PG_VERSION} (${triple})"
  curl -fsSL --retry 4 --retry-delay 2 -o "$tarball" "$url"
fi

prefix="$cache/prefix"
rm -rf "$prefix"
mkdir -p "$prefix"
tar -xzf "$tarball" -C "$prefix"

dir="$(find "$prefix" -type f -name initdb -printf '%h\n' -quit || true)"
if ! have_server "$dir"; then
  echo "extracted archive is missing initdb/postgres" >&2
  find "$prefix" -maxdepth 5 -type f | head >&2
  exit 1
fi
export_bindir "$dir"
