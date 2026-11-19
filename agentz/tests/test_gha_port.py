"""GitHub Actions ports: read-only, no shell, no credentials, dry-run touches nothing."""

from __future__ import annotations

import yaml

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers.gha_port import (
    PORTS,
    Port,
    check_port,
    child_env,
    repo_root,
    run,
)


def test_every_port_is_allowed_and_registered():
    root = repo_root()
    raw = yaml.safe_load((root / "agentz/workflows/registry.yaml").read_text(encoding="utf-8"))
    by_id = {w["id"]: w for w in raw["workflows"]}
    for wid, port in PORTS.items():
        assert check_port(port, root) == [], wid
        assert by_id[wid]["handler"] == "handlers.gha_port"
        assert by_id[wid]["financial_limit_usd"] == 0


def test_release_and_outbound_ports_are_refused():
    root = repo_root()
    for script in (
        "scripts/ci/promote-worker-version.mjs",
        "scripts/deploy.mjs",
        "scripts/send-outreach.mjs",
        "../etc/passwd",
        "workers/x/index.mjs",
    ):
        assert check_port(Port(source="x", script=script), root), script
    leaky = Port(source="x", script="scripts/launch/honest-launch-gate.mjs", pass_env=("GITHUB_TOKEN",))
    assert any("credential" in p for p in check_port(leaky, root))


def test_child_env_is_minimal(monkeypatch):
    monkeypatch.setenv("AGENT_SECRET", "do-not-pass")
    monkeypatch.setenv("SAFE_FLAG", "1")
    env = child_env(Port(source="x", script="scripts/a.mjs", pass_env=("SAFE_FLAG",)))
    assert "AGENT_SECRET" not in env
    assert env["SAFE_FLAG"] == "1"


def test_dry_run_runs_nothing(monkeypatch):
    import subprocess

    def boom(*a, **k):
        raise AssertionError("subprocess ran in dry-run")

    monkeypatch.setattr(subprocess, "run", boom)
    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="gha_autonomy_manifest_check")
    out = run(ctx)
    assert out.startswith("dry-run: would run `node scripts/autonomy/reconcile.mjs --check`")


def test_unknown_workflow_is_red():
    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="gha_not_a_port")
    assert run(ctx).startswith("red:")
