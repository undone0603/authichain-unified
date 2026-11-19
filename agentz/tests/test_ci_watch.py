"""ci_watch is read-only and classifies fleet and gate state."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import yaml

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import ci_watch
from agentz.workflows.handlers.ci_watch import GATE, RUNNER_UNITS, evaluate, run
from agentz.workflows.handlers.gha_port import repo_root

NOW = datetime(2026, 11, 19, 22, 0, tzinfo=timezone.utc)
SHA = "9734e4131" + "0" * 31
ALL_UP = {u: "active" for u in RUNNER_UNITS}


def lint(status="completed", conclusion="success", sha=SHA):
    return {"id": 1, "head_sha": sha, "status": status, "conclusion": conclusion}


def test_registered_read_only_and_free():
    raw = yaml.safe_load((repo_root() / "agentz/workflows/registry.yaml").read_text(encoding="utf-8"))
    entry = {w["id"]: w for w in raw["workflows"]}["ci_watch"]
    assert entry["handler"] == "handlers.ci_watch"
    assert entry["financial_limit_usd"] == 0
    assert entry["requires_human_approval"] is False


def test_green_when_everything_passes():
    verdict, findings = evaluate(ALL_UP, SHA, NOW, "success", lint(), NOW)
    assert verdict == "green", findings


def test_runner_down_is_red():
    units = dict(ALL_UP, **{"actions-runner-deploy.service": "inactive"})
    verdict, findings = evaluate(units, SHA, NOW, "success", lint(), NOW)
    assert verdict == "red"
    assert any("actions-runner-deploy.service is inactive" in f for f in findings)


def test_gate_pending_is_amber_then_red_when_stuck():
    fresh, _ = evaluate(ALL_UP, SHA, NOW - timedelta(minutes=20), "pending", lint(), NOW)
    stuck, findings = evaluate(ALL_UP, SHA, NOW - timedelta(hours=3), "pending", lint(), NOW)
    assert fresh == "amber"
    assert stuck == "red"
    assert any(GATE in f and "3h" in f for f in findings)


def test_gate_failure_and_lint_failure_are_red():
    assert evaluate(ALL_UP, SHA, NOW, "failure", lint(), NOW)[0] == "red"
    assert evaluate(ALL_UP, SHA, NOW, "success", lint(conclusion="failure"), NOW)[0] == "red"


def test_cancelled_or_running_lint_is_amber():
    assert evaluate(ALL_UP, SHA, NOW, "success", lint(conclusion="cancelled"), NOW)[0] == "amber"
    assert evaluate(ALL_UP, SHA, NOW, "success", lint(status="queued", conclusion=None), NOW)[0] == "amber"


def test_run_only_reads_and_checkpoints(monkeypatch, tmp_path):
    import agentz.core.modes as modes

    monkeypatch.setattr(modes, "CHECKPOINT_DIR", tmp_path)
    paths = []

    def fake_get(path):
        paths.append(path)
        if path == "commits/main":
            return {"sha": SHA, "commit": {"committer": {"date": "2026-11-19T21:50:00Z"}}}
        if path.startswith(f"commits/{SHA}/statuses"):
            return [{"context": GATE, "state": "success"}]
        return {"workflow_runs": [lint()]}

    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="ci_watch", verbose=False)
    out = run(ctx, get_json=fake_get, get_unit=lambda u: "active")
    assert out.startswith("green")
    assert all(not p.startswith(("actions/runs/", "pulls/", "merges")) for p in paths)
    assert ctx.load_state()["verdict"] == "green"


def test_github_failure_is_red_not_green(monkeypatch, tmp_path):
    import agentz.core.modes as modes

    monkeypatch.setattr(modes, "CHECKPOINT_DIR", tmp_path)

    def boom(path):
        raise OSError("rate limited")

    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="ci_watch", verbose=False)
    assert run(ctx, get_json=boom, get_unit=lambda u: "active").startswith("red: GitHub read failed")


def test_handler_never_shells_out_beyond_systemctl_is_active(monkeypatch):
    calls = []

    class Done:
        stdout = "active\n"

    def fake_run(argv, **kwargs):
        calls.append(argv)
        return Done()

    monkeypatch.setattr(ci_watch.subprocess, "run", fake_run)
    assert ci_watch.unit_state("actions-runner.service") == "active"
    assert calls == [["systemctl", "--user", "is-active", "actions-runner.service"]]
