"""Repo audit agent: banner integration stays narrow and dry-run is read-only."""

from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers.repo_audit_integrate import (
    CANONICAL_END,
    CANONICAL_START,
    apply_canonical_banner,
    audit,
    pushes_every_main_commit,
    repo_root,
    run,
)


HISTORICAL = """# AuthiChain Network Map

_As of 2026-07-15._

- `apps/*` trees are deliberately inert: excluded from root `tsconfig.json` and not in any pnpm workspace.
"""


def test_banner_preserves_crlf():
    once = apply_canonical_banner(HISTORICAL.replace("\n", "\r\n"))
    assert "\r\n" in once
    assert "\n" not in once.replace("\r\n", "")
    assert apply_canonical_banner(once) == once
    once = apply_canonical_banner(HISTORICAL)
    twice = apply_canonical_banner(once)
    assert once == twice
    assert once.count(CANONICAL_START) == 1
    assert "Cloudflare Workers" in once.split(CANONICAL_END)[0]
    assert once.split(CANONICAL_END, 1)[1].count("# AuthiChain Network Map") == 0
    assert "## Historical inventory (2026-07-15)" in once


def test_unfiltered_main_push_detector():
    assert pushes_every_main_commit("on:\n  push:\n    branches:\n      - main\njobs: {}\n")
    assert not pushes_every_main_commit(
        "on:\n  push:\n    branches: [main]\n    paths:\n      - workers/**\njobs: {}\n"
    )
    assert not pushes_every_main_commit("on:\n  workflow_dispatch:\njobs: {}\n")


def test_registry_registers_agent():
    import yaml

    raw = yaml.safe_load((repo_root() / "agentz/workflows/registry.yaml").read_text(encoding="utf-8"))
    matches = [item for item in raw["workflows"] if item["id"] == "repo_audit_integrate"]
    assert len(matches) == 1
    workflow = matches[0]
    assert workflow["handler"] == "handlers.repo_audit_integrate"
    assert workflow["requires"] == []
    assert workflow["risk_class"] == "low"
    assert workflow["requires_human_approval"] is False
    allowed = {
        "id",
        "title",
        "priority",
        "blocks_revenue",
        "handler",
        "type",
        "estimated_minutes",
        "requires",
        "prerequisites",
        "description",
        "confirm_before_run",
        "max_runs_per_day",
        "notifications",
        "context_fetcher",
        "max_retries",
        "risk_class",
        "financial_limit_usd",
        "reputational_impact",
        "requires_human_approval",
        "rollback_strategy",
    }
    assert set(workflow) <= allowed
    report = audit(repo_root())
    codes = {item.code for item in report.findings}
    assert "mutations_refused" in codes
    assert "scheduled_workflow_load" in codes
    assert report.counts["workflows"] > 0


def test_checked_in_network_map_is_marked():
    text = (repo_root() / "docs/NETWORK.md").read_text(encoding="utf-8")
    assert CANONICAL_START in text
    assert "not a launch gate" in text


def test_dry_run_does_not_write():
    root = repo_root()
    before = {
        path: path.read_bytes()
        for path in (
            root / "docs/NETWORK.md",
            root / "docs/operations/REPO-INTEGRATION-AUDIT.md",
        )
        if path.is_file()
    }
    run(ExecutionContext(mode=Mode.DRY_RUN, workflow_id="repo_audit_integrate", verbose=False))
    for path, payload in before.items():
        assert path.read_bytes() == payload
