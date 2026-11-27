"""Fail-closed policy for agentz.workflows.runner and agentz.core.runner (#2289)."""
from __future__ import annotations

import json
import types
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from agentz.core import runner as core_runner
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.risk_firewall import assess_workflow, should_force_confirm
from agentz.workflows import runner as wf_runner
from agentz.workflows.handlers.gsc_setup import run as run_gsc_setup


def _wf(**overrides):
    base = dict(
        id="policy_probe", title="t", priority="low", blocks_revenue=False,
        handler="handlers.policy_probe", type="shell", estimated_minutes=1,
        risk_class="low",
    )
    base.update(overrides)
    return core_runner.Workflow(**base)


@pytest.fixture
def probe(monkeypatch, tmp_path):
    """Install a fake handler module and registry; record the mode it ran in."""
    calls: list[Mode] = []
    module = types.ModuleType("agentz.workflows.handlers.policy_probe")
    module.run = lambda ctx: calls.append(ctx.mode) or "ran"
    monkeypatch.setitem(__import__("sys").modules, module.__name__, module)
    registry: dict = {"policy_probe": _wf()}
    monkeypatch.setattr(core_runner, "load_registry", lambda *a, **k: registry)
    monkeypatch.setattr(wf_runner, "AUDIT_LOG_PATH", tmp_path / "runs.jsonl")
    monkeypatch.delenv("AGENTZ_MODE", raising=False)
    monkeypatch.delenv("AGENTZ_PROTOCOL_VETO", raising=False)
    return types.SimpleNamespace(calls=calls, registry=registry, log=tmp_path / "runs.jsonl")


def test_no_flags_runs_dry_run_not_auto(probe):
    assert wf_runner.main(["--handler", "policy_probe"]) == 0
    assert probe.calls == [Mode.DRY_RUN]


def test_explicit_auto_is_honoured_for_low_risk(probe):
    assert wf_runner.main(["--handler", "policy_probe", "--mode", "auto"]) == 0
    assert probe.calls == [Mode.AUTO]


@pytest.mark.parametrize("mode", ["auto", "confirm"])
def test_unregistered_handler_refused_outside_dry_run(probe, mode):
    probe.registry.clear()
    assert wf_runner.main(["--handler", "policy_probe", "--mode", mode]) == wf_runner.POLICY_REFUSED
    assert probe.calls == []


def test_unregistered_handler_may_dry_run(probe):
    probe.registry.clear()
    assert wf_runner.main(["--handler", "policy_probe", "--mode", "dry-run"]) == 0
    assert probe.calls == [Mode.DRY_RUN]


def test_invalid_handler_name_rejected(probe):
    assert wf_runner.main(["--handler", "../os", "--mode", "dry-run"]) == 1


@pytest.mark.parametrize(
    "overrides",
    [{"risk_class": "high"}, {"requires_human_approval": True}, {"confirm_before_run": True}],
)
def test_escalation_to_confirm_without_tty_is_refused(probe, monkeypatch, overrides):
    probe.registry["policy_probe"] = _wf(**overrides)
    monkeypatch.setattr("sys.stdin", types.SimpleNamespace(isatty=lambda: False))
    assert wf_runner.main(["--handler", "policy_probe", "--mode", "auto"]) == wf_runner.POLICY_REFUSED
    assert probe.calls == []


def _spend(log, wf_id, amount):
    log.write_text(json.dumps({
        "workflow_id": wf_id, "status": "ok", "cost_usd": amount,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }) + "\n")


def test_registry_budget_enforced_not_placeholder(probe):
    probe.registry["policy_probe"] = _wf(financial_limit_usd=1.0)
    _spend(probe.log, "policy_probe", 1.0)
    assert wf_runner.main(["--handler", "policy_probe", "--mode", "auto"]) == wf_runner.POLICY_REFUSED
    assert probe.calls == []


def test_protocol_veto_blocks(probe, monkeypatch):
    probe.registry.clear()
    probe.registry["protocol_schema_validate"] = _wf(
        id="protocol_schema_validate", risk_class="critical")
    monkeypatch.setenv("AGENTZ_PROTOCOL_VETO", "1")
    assert wf_runner.main(["--handler", "policy_probe", "--mode", "auto"]) == wf_runner.POLICY_REFUSED
    assert probe.calls == []


def test_most_restrictive_entry_wins_when_handler_shared():
    reg = {
        "a": _wf(id="a", risk_class="low"),
        "b": _wf(id="b", risk_class="high"),
    }
    assert wf_runner.resolve_registry_entry("policy_probe", reg).id == "b"


def test_scheduled_callers_are_registered():
    """Every handler a workflow runs live through the legacy runner must resolve."""
    for handler in ("ghost_traffic_engine", "authichain_compliance_audit", "repo_audit_integrate"):
        assert wf_runner.resolve_registry_entry(handler) is not None, handler


def test_core_execute_blocks_on_exhausted_budget(monkeypatch, tmp_path, probe):
    monkeypatch.setattr(core_runner, "check_all", lambda required: ([], []))
    monkeypatch.setattr(core_runner, "_trigger_notifications", lambda *a: None)
    log = tmp_path / "core.jsonl"
    _spend(log, "policy_probe", 5.0)
    result = core_runner.execute(_wf(financial_limit_usd=5.0), Mode.AUTO, audit_log_path=log)
    assert result.status == "blocked"
    assert "budget exhausted" in result.notes
    assert probe.calls == []


def test_core_execute_dry_run_skips_budget_gate(monkeypatch, tmp_path, probe):
    monkeypatch.setattr(core_runner, "check_all", lambda required: ([], []))
    log = tmp_path / "core.jsonl"
    _spend(log, "policy_probe", 5.0)
    result = core_runner.execute(_wf(financial_limit_usd=5.0), Mode.DRY_RUN, audit_log_path=log)
    assert result.status != "blocked"


def _gsc_context(tmp_path: Path, mode: Mode):
    workspace = tmp_path / "workspace"
    workspace.mkdir(exist_ok=True)
    ctx = ExecutionContext(
        mode=mode, workflow_id="gsc_setup_authichain", verbose=False
    )
    return workspace, ctx, tmp_path / "AuthiChain" / "public" / "google7c95eee4dd86e0e9.html"


def test_gsc_setup_dry_run_does_not_create_directories(tmp_path, monkeypatch):
    workspace, ctx, target = _gsc_context(tmp_path, Mode.DRY_RUN)
    monkeypatch.setattr("agentz.workflows.handlers.gsc_setup.os.getcwd", lambda: str(workspace))
    result = run_gsc_setup(ctx)
    assert "dry-run" in result
    assert not target.parent.exists()


def test_gsc_setup_confirm_decline_does_not_create_directories(tmp_path, monkeypatch):
    workspace, ctx, target = _gsc_context(tmp_path, Mode.CONFIRM)
    monkeypatch.setattr("agentz.workflows.handlers.gsc_setup.os.getcwd", lambda: str(workspace))
    with patch("builtins.input", return_value="n"):
        result = run_gsc_setup(ctx)
    assert "not completed" in result
    assert not target.parent.exists()


def test_gsc_setup_auto_creates_file_only_inside_target(tmp_path, monkeypatch):
    workspace, ctx, target = _gsc_context(tmp_path, Mode.AUTO)
    monkeypatch.setattr("agentz.workflows.handlers.gsc_setup.os.getcwd", lambda: str(workspace))
    result = run_gsc_setup(ctx)
    assert "complete" in result
    assert target.read_text(encoding="utf-8") == "google-site-verification: google7c95eee4dd86e0e9.html"


def test_unclassified_risk_escalates_to_confirm(probe):
    assessment = assess_workflow(
        wf_id="policy_probe",
        risk_class="unclassified",
        financial_limit_usd=0,
        requires_human_approval=False,
        current_mode="auto",
        audit_log_path=probe.log,
    )
    assert assessment.approved
    assert assessment.escalated_mode == "confirm"
    assert "unclassified" in assessment.reason
    assert should_force_confirm("unclassified", False, "auto")


def test_unclassified_registered_handler_refused_without_tty(probe, monkeypatch):
    probe.registry["policy_probe"] = _wf(risk_class="unknown")
    monkeypatch.setattr("sys.stdin", types.SimpleNamespace(isatty=lambda: False))
    assert wf_runner.main(["--handler", "policy_probe", "--mode", "auto"]) == wf_runner.POLICY_REFUSED
    assert probe.calls == []


def test_core_execute_unknown_risk_blocks_before_context_fetcher(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(core_runner, "check_all", lambda required: ([], []))
    monkeypatch.setattr("sys.stdin", types.SimpleNamespace(isatty=lambda: False))
    monkeypatch.setattr(
        "subprocess.check_output",
        lambda *args, **kwargs: calls.append((args, kwargs)) or "must not run",
    )
    wf = _wf(risk_class="unknown", context_fetcher="echo must-not-run")
    result = core_runner.execute(wf, Mode.AUTO, audit_log_path=tmp_path / "core.jsonl")
    assert result.status == "blocked"
    assert "no TTY" in result.notes
    assert calls == []
