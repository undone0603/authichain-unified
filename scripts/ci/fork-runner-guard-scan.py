#!/usr/bin/env python3
"""Emit unguarded self-hosted jobs that a fork PR or workflow_run can reach.

Used by scripts/ci/pr-runner-boundaries.test.mjs. Prints a JSON array.
A job is unguarded when a pull_request, pull_request_target, or workflow_run
trigger can place untrusted code on a self-hosted runner without the same-repo
(or workflow_run head_repository) check. `if: false` is not a fork guard.
"""

from __future__ import annotations

import json
from pathlib import Path

import yaml

SAME_REPO = "github.event.pull_request.head.repo.full_name == github.repository"
WR_REPO = "github.event.workflow_run.head_repository.full_name == github.repository"
DEPENDABOT = "github.actor == 'dependabot[bot]'"
HOSTED = ("ubuntu-24.04", "ubuntu-latest", "ubuntu-22.04")


def on_block(data: dict) -> dict:
    on = data.get("on", data.get(True))
    if on is None:
        return {}
    if isinstance(on, str):
        return {on: None}
    if isinstance(on, list):
        return {str(k): None for k in on}
    if isinstance(on, dict):
        return {str(k): v for k, v in on.items()}
    return {}


def job_if(job: dict) -> str:
    value = job.get("if")
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def job_runs(job: dict) -> str:
    value = job.get("runs-on")
    if isinstance(value, list):
        return " ".join(str(x) for x in value)
    return "" if value is None else str(value)


def is_self_hosted(runs: str) -> bool:
    return "self-hosted" in runs


def hosted_only(runs: str) -> bool:
    text = runs.strip()
    if is_self_hosted(text):
        return False
    return text in HOSTED or (
        "ubuntu-24.04" in text and "fromJSON" not in text and "self-hosted" not in text
    )


def pr_event_excluded(cond: str, has_prt: bool) -> bool:
    """True when the job cannot run on pull_request / pull_request_target."""
    if not cond or cond in ("true", "false"):
        return False
    if has_prt:
        # `!= 'pull_request'` is true for pull_request_target.
        if (
            "github.event_name == 'workflow_dispatch'" in cond
            and "pull_request" not in cond
        ):
            return True
        if "github.event_name == 'push'" in cond and "pull_request" not in cond:
            return True
        return False
    if "github.event_name != 'pull_request'" in cond:
        return True
    if (
        "github.event_name == 'workflow_dispatch'" in cond
        and "pull_request" not in cond
    ):
        return True
    if "github.event_name == 'push'" in cond and "pull_request" not in cond:
        return True
    return False


def pr_runs_on_guarded(runs: str, has_prt: bool) -> bool:
    """Self-hosted expression that cannot select the laptop for a fork PR."""
    if not is_self_hosted(runs):
        return True
    hosted_fallback = "'ubuntu-24.04'" in runs or '"ubuntu-24.04"' in runs
    if not hosted_fallback:
        return False
    if SAME_REPO in runs:
        return True
    # PRs never match event_name == 'push' (AgentZ CI).
    if "github.event_name == 'push'" in runs:
        return True
    # != pull_request is true for pull_request_target, so it is not a PRT guard.
    if has_prt:
        return False
    return "github.event_name != 'pull_request'" in runs


def prt_guarded(runs: str, cond: str) -> bool:
    blob = f"{runs}\n{cond}"
    if hosted_only(runs):
        return True
    return SAME_REPO in blob and DEPENDABOT in blob


def wr_guarded(runs: str, cond: str) -> bool:
    blob = f"{runs}\n{cond}"
    if not is_self_hosted(runs):
        return True
    return WR_REPO in blob


def scan(root: Path) -> list[dict]:
    unguarded = []
    for path in sorted(root.glob("*.yml")):
        data = yaml.safe_load(path.read_text()) or {}
        if not isinstance(data, dict):
            continue
        on = on_block(data)
        has_pr = "pull_request" in on
        has_prt = "pull_request_target" in on
        has_wr = "workflow_run" in on
        if not (has_pr or has_prt or has_wr):
            continue
        jobs = data.get("jobs") or {}
        for name, job in jobs.items():
            if not isinstance(job, dict):
                continue
            runs = job_runs(job)
            cond = job_if(job)
            issues = []
            if has_pr and is_self_hosted(runs) and not pr_event_excluded(cond, has_prt):
                if not pr_runs_on_guarded(runs, has_prt) and SAME_REPO not in cond:
                    issues.append("pull_request")
            if has_prt and is_self_hosted(runs) and not pr_event_excluded(cond, True):
                if not prt_guarded(runs, cond):
                    issues.append("pull_request_target")
            if has_wr and is_self_hosted(runs) and not wr_guarded(runs, cond):
                issues.append("workflow_run")
            if issues:
                unguarded.append(
                    {
                        "file": path.name,
                        "job": name,
                        "issues": issues,
                    }
                )
    return unguarded


def _self_test() -> None:
    import tempfile
    import textwrap

    cases = [
        (
            "bare-prt.yml",
            textwrap.dedent(
                """
                on:
                  pull_request_target:
                jobs:
                  auto:
                    runs-on: [self-hosted, Linux, ARM64, x]
                """
            ),
            ["pull_request_target"],
        ),
        (
            "hosted-prt.yml",
            textwrap.dedent(
                """
                on:
                  pull_request_target:
                jobs:
                  auto:
                    runs-on: ubuntu-24.04
                """
            ),
            [],
        ),
        (
            "bare-pr.yml",
            textwrap.dedent(
                """
                on:
                  pull_request:
                jobs:
                  unit:
                    runs-on: [self-hosted, Linux, ARM64, x]
                """
            ),
            ["pull_request"],
        ),
        (
            "guarded-pr.yml",
            textwrap.dedent(
                """
                on:
                  pull_request:
                jobs:
                  unit:
                    runs-on: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && fromJSON('["self-hosted"]') || 'ubuntu-24.04' }}
                """
            ),
            [],
        ),
        (
            "bare-wr.yml",
            textwrap.dedent(
                """
                on:
                  workflow_run:
                    workflows: ["CI Main"]
                    types: [completed]
                jobs:
                  classify:
                    runs-on: [self-hosted]
                """
            ),
            ["workflow_run"],
        ),
        (
            "guarded-wr.yml",
            textwrap.dedent(
                """
                on:
                  workflow_run:
                    workflows: ["CI Main"]
                    types: [completed]
                jobs:
                  classify:
                    if: github.event.workflow_run.head_repository.full_name == github.repository
                    runs-on: [self-hosted]
                """
            ),
            [],
        ),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        want = {}
        for name, source, issues in cases:
            (root / name).write_text(source)
            job = next(iter((yaml.safe_load(source) or {})["jobs"]))
            if issues:
                want[(name, job)] = issues
        got_map = {(row["file"], row["job"]): row["issues"] for row in scan(root)}
        if got_map != want:
            raise SystemExit(f"self-test failed: got {got_map!r} want {want!r}")


if __name__ == "__main__":
    import sys

    if "--self-test" in sys.argv:
        _self_test()
        sys.stdout.write("ok\n")
        raise SystemExit(0)
    json.dump(scan(Path(".github/workflows")), sys.stdout)
    sys.stdout.write("\n")
