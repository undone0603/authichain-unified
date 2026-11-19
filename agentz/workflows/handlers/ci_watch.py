"""
agentz.workflows.handlers.ci_watch
----------------------------------
Read-only watch over the self-hosted CI fleet and main's required gate.

Checks, without changing anything:
- the three self-hosted runner services on this host (systemd --user),
- ci/circleci: main-quality-gate on main's head commit,
- the newest Lint run on main.

The repository is public, so GitHub reads work without a token; a token in
GITHUB_TOKEN / AGENTZ_GITHUB_TOKEN only raises the rate limit. The handler
never cancels, re-runs, restarts, merges or deploys. It records the last
verdict in its checkpoint so callers can alert on transitions only.
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable

from agentz.core.modes import ExecutionContext

REPO = "undone0603/authichain-unified"
API = f"https://api.github.com/repos/{REPO}"
GATE = "ci/circleci: main-quality-gate"
RUNNER_UNITS = (
    "actions-runner.service",  # LAPTOP-72MAGTL2 (authichain-ops/ci/wsl)
    "actions-runner-wsl.service",  # wsl-zac-arm64 (authichain-ops/wsl)
    "actions-runner-deploy.service",  # wsl-deploy-arm64 (authichain-deploy only)
)
# A required gate still pending on a main head older than this is stuck.
GATE_STUCK_AFTER_S = 2 * 60 * 60


def _get_json(path: str) -> Any:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.getenv("GITHUB_TOKEN") or os.getenv("AGENTZ_GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{API}/{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def unit_state(unit: str) -> str:
    try:
        out = subprocess.run(
            ["systemctl", "--user", "is-active", unit],
            capture_output=True, text=True, timeout=10, check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return f"unknown ({type(exc).__name__})"
    return out.stdout.strip() or "unknown"


def evaluate(
    units: dict[str, str],
    main_sha: str,
    main_committed_at: datetime,
    gate_state: str | None,
    lint: dict[str, Any] | None,
    now: datetime,
) -> tuple[str, list[str]]:
    """Return (verdict, findings). Verdict is green, amber or red."""
    red: list[str] = []
    amber: list[str] = []
    for unit, state in units.items():
        if state != "active":
            red.append(f"runner {unit} is {state}")
    short = main_sha[:9]
    age = (now - main_committed_at).total_seconds()
    if gate_state == "success":
        pass
    elif gate_state in ("failure", "error"):
        red.append(f"{GATE} is {gate_state} on main {short}")
    elif age > GATE_STUCK_AFTER_S:
        red.append(f"{GATE} is {gate_state or 'missing'} on main {short} after {int(age // 3600)}h")
    else:
        amber.append(f"{GATE} is {gate_state or 'not reported yet'} on main {short}")
    if lint is None:
        amber.append("no Lint run found on main")
    else:
        lint_sha = str(lint.get("head_sha", ""))[:9]
        status, conclusion = lint.get("status"), lint.get("conclusion")
        where = f"Lint run {lint.get('id')} on {lint_sha}"
        if status != "completed":
            amber.append(f"{where} is {status}")
        elif conclusion == "success":
            if lint_sha != short:
                amber.append(f"newest finished {where} is not main's head {short}")
        elif conclusion in ("cancelled", "skipped"):
            amber.append(f"{where} was {conclusion}")
        else:
            red.append(f"{where} concluded {conclusion}")
    if red:
        return "red", red + amber
    if amber:
        return "amber", amber
    return "green", [f"3 runners active, {GATE} green and Lint green on main {short}"]


def run(
    ctx: ExecutionContext,
    get_json: Callable[[str], Any] = _get_json,
    get_unit: Callable[[str], str] = unit_state,
) -> str:
    # Read-only in every mode: nothing here acts on GitHub or the host.
    units = {u: get_unit(u) for u in RUNNER_UNITS}
    try:
        commit = get_json("commits/main")
        sha = commit["sha"]
        committed = datetime.fromisoformat(
            commit["commit"]["committer"]["date"].replace("Z", "+00:00")
        )
        statuses = get_json(f"commits/{sha}/statuses?per_page=100")
        gate = next((s["state"] for s in statuses if s.get("context") == GATE), None)
        runs = get_json("actions/workflows/lint.yml/runs?branch=main&per_page=1")
        lint = (runs.get("workflow_runs") or [None])[0]
    except Exception as exc:  # network, rate limit, or shape change
        return f"red: GitHub read failed ({type(exc).__name__}: {exc})"

    verdict, findings = evaluate(units, sha, committed, gate, lint, datetime.now(timezone.utc))
    previous = ctx.load_state().get("verdict")
    ctx.save_state({
        "verdict": verdict,
        "previous": previous,
        "main": sha,
        "findings": findings,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    })
    changed = " (changed from %s)" % previous if previous and previous != verdict else ""
    for finding in findings:
        ctx.step(finding)
    return f"{verdict}{changed}: " + "; ".join(findings)
