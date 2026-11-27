#!/usr/bin/env bash
# Self-hosted WSL Actions Runner Watchdog (for LAPTOP-72MAGTL2 / wsl-zac-arm64)
# Prevents "runner lost communication" failures caused by disk exhaustion or stalled Listener processes.
set -euo pipefail

RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner}"
MIN_FREE_KB="${MIN_FREE_KB:-5242880}" # 5 GB minimum free space

free_kb=$(df -Pk "$RUNNER_DIR" | awk 'NR==2 {print $4}')
if [ "${free_kb:-0}" -lt "$MIN_FREE_KB" ]; then
  echo "[watchdog] Low disk (${free_kb} KB < ${MIN_FREE_KB} KB). Pruning _work/_temp and pnpm store..."
  rm -rf "$RUNNER_DIR/_work/_temp"/* 2>/dev/null || true
  pnpm store prune 2>/dev/null || true
fi

if ! pgrep -f "Runner.Listener" >/dev/null 2>&1; then
  echo "[watchdog] Runner.Listener is down. Restarting svc.sh / runsvc.sh..."
  cd "$RUNNER_DIR"
  if [ -x "./svc.sh" ]; then
    sudo ./svc.sh restart || nohup ./run.sh >/tmp/actions-runner.log 2>&1 &
  else
    nohup ./run.sh >/tmp/actions-runner.log 2>&1 &
  fi
else
  echo "[watchdog] Runner.Listener healthy (free=${free_kb} KB)."
fi
