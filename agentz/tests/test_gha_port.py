"""GitHub Actions ports remain disabled until host isolation is verified."""

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


def test_symlink_outside_checkout_is_refused(tmp_path):
    root = tmp_path / "checkout"
    script = root / "scripts" / "launch" / "honest-launch-gate.mjs"
    script.parent.mkdir(parents=True)
    outside = tmp_path / "external.mjs"
    outside.write_text("// harmless synthetic script\n", encoding="utf-8")
    script.symlink_to(outside)
    port = Port(source="synthetic", script="scripts/launch/honest-launch-gate.mjs")
    assert any("resolves outside" in problem for problem in check_port(port, root))


def test_live_modes_never_spawn_or_prompt(monkeypatch):
    import subprocess

    def boom(*args, **kwargs):
        raise AssertionError("disabled execution must not spawn or prompt")

    monkeypatch.setattr(subprocess, "run", boom)
    monkeypatch.setattr("builtins.input", boom)
    for workflow_id in (*PORTS, "gha_not_a_port"):
        for mode in (Mode.AUTO, Mode.CONFIRM):
            try:
                run(ExecutionContext(mode=mode, workflow_id=workflow_id))
            except RuntimeError as error:
                assert str(error) == "host execution disabled until an isolated executor is verified"
            else:
                raise AssertionError("disabled execution must raise an error")


def test_cli_runner_reports_disabled_execution_as_failure(monkeypatch):
    from agentz.core import risk_firewall
    from agentz.workflows import runner

    monkeypatch.setattr(
        risk_firewall, "assess_workflow",
        lambda **kwargs: risk_firewall.RiskAssessment(approved=True),
    )
    assert runner.main(["--handler", "gha_port", "--mode", "auto"]) == 1


def test_registry_runner_reports_disabled_execution_as_failed(monkeypatch, tmp_path):
    from agentz.core import runner

    monkeypatch.setattr(runner, "check_all", lambda required: ([], []))
    monkeypatch.setattr(runner, "_trigger_notifications", lambda *args: None)
    workflow = runner.Workflow(
        id="gha_honest_launch_gate", title="test", priority="medium",
        blocks_revenue=False, handler="handlers.gha_port", type="shell",
        estimated_minutes=1, risk_class="low",
    )
    result = runner.execute(workflow, Mode.AUTO, audit_log_path=tmp_path / "runs.jsonl")
    assert result.status == "failed"
    assert "host execution disabled" in result.error
