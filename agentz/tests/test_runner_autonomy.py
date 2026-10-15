"""Runner integration: kill switch, registry policy and the approval gate."""
from __future__ import annotations

import sys
import types

import pytest

from agentz.core import autonomy_policy as ap
from agentz.workflows import runner


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENTZ_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("AGENTZ_KILL_FILE", str(tmp_path / "KILL"))
    monkeypatch.delenv("AGENTZ_KILL_SWITCH", raising=False)
    monkeypatch.chdir(tmp_path)  # the runner writes agentz/logs relative to cwd


@pytest.fixture
def handler(monkeypatch):
    """Install a fake handler module and return the list of its calls."""
    calls: list[str] = []

    def install(name: str, entries=None):
        module = types.ModuleType(f"agentz.workflows.handlers.{name}")
        module.run = lambda ctx: calls.append(name) or "done"
        monkeypatch.setitem(sys.modules, module.__name__, module)
        pool = entries if entries is not None else []
        monkeypatch.setattr(ap, "load_registry", lambda path=None: pool)

    install.calls = calls
    return install


CONFIRM_ENTRY = [{"id": "wf_gated", "handler": "handlers.gated", "confirm_before_run": True}]


def test_workflow_missing_from_registry_runs_as_before(handler):
    handler("plain")
    assert runner.main(["--handler", "plain", "--mode", "auto"]) == 0
    assert handler.calls == ["plain"]


def test_kill_switch_halts_before_the_handler_runs(handler, monkeypatch):
    handler("plain")
    monkeypatch.setenv("AGENTZ_KILL_SWITCH", "1")
    assert runner.main(["--handler", "plain", "--mode", "auto"]) == runner.EXIT_KILL_SWITCH
    assert handler.calls == []


def test_kill_file_halts_even_gated_workflows(handler):
    handler("gated", CONFIRM_ENTRY)
    ap.engage_kill_switch("test")
    assert runner.main(["--handler", "gated", "--mode", "auto"]) == runner.EXIT_KILL_SWITCH
    assert ap.list_requests() == []  # a halted run must not queue approvals


def test_confirm_before_run_blocks_unattended_auto_runs(handler):
    handler("gated", CONFIRM_ENTRY)
    assert runner.main(["--handler", "gated", "--mode", "auto"]) == runner.EXIT_APPROVAL_REQUIRED
    assert handler.calls == []
    pending = ap.list_requests()
    assert [r["workflow_id"] for r in pending] == ["wf_gated"]
    assert pending[0]["status"] == "pending"


def test_repeated_blocked_runs_do_not_pile_up_requests(handler):
    handler("gated", CONFIRM_ENTRY)
    for _ in range(3):
        assert runner.main(["--handler", "gated", "--mode", "auto"]) == runner.EXIT_APPROVAL_REQUIRED
    assert len(ap.list_requests()) == 1


def test_approval_unlocks_exactly_one_run(handler):
    handler("gated", CONFIRM_ENTRY)
    runner.main(["--handler", "gated", "--mode", "auto"])
    request_id = ap.list_requests()[0]["id"]
    assert ap.decide(request_id, True, by="zac")
    assert runner.main(["--handler", "gated", "--mode", "auto"]) == 0
    assert handler.calls == ["gated"]
    assert runner.main(["--handler", "gated", "--mode", "auto"]) == runner.EXIT_APPROVAL_REQUIRED
    assert handler.calls == ["gated"]  # approval was single-use


def test_rejected_request_keeps_the_gate_closed(handler):
    handler("gated", CONFIRM_ENTRY)
    runner.main(["--handler", "gated", "--mode", "auto"])
    ap.decide(ap.list_requests()[0]["id"], False, by="zac")
    assert runner.main(["--handler", "gated", "--mode", "auto"]) == runner.EXIT_APPROVAL_REQUIRED
    assert handler.calls == []


def test_dry_run_is_not_gated(handler):
    handler("gated", CONFIRM_ENTRY)
    assert runner.main(["--handler", "gated", "--mode", "dry-run"]) == 0
    assert ap.list_requests() == []


def test_strict_mode_halts_when_registry_is_unreadable(tmp_path, monkeypatch):
    bad = tmp_path / "registry.yaml"
    bad.write_text("workflows: [unclosed", encoding="utf-8")
    monkeypatch.setattr(ap, "REGISTRY_PATH", bad)
    monkeypatch.setenv("AGENTZ_POLICY_STRICT", "1")
    calls: list[str] = []
    module = types.ModuleType("agentz.workflows.handlers.plain")
    module.run = lambda ctx: calls.append("plain")
    monkeypatch.setitem(sys.modules, module.__name__, module)
    assert runner.main(["--handler", "plain", "--mode", "auto"]) == runner.EXIT_POLICY_UNAVAILABLE
    assert calls == []


def _verify_entry(check):
    return [{"id": "wf_v", "handler": "handlers.vf", "verify": [check]}]


def test_failed_verification_turns_a_clean_handler_into_exit_12(handler, tmp_path):
    handler("vf", _verify_entry({"type": "file_exists", "path": str(tmp_path / "never.txt")}))
    assert runner.main(["--handler", "vf", "--mode", "auto"]) == runner.EXIT_VERIFY_FAILED
    assert handler.calls == ["vf"]  # the handler did run; the verdict is independent


def test_passing_verification_keeps_exit_zero(handler, tmp_path):
    marker = tmp_path / "ok.txt"
    marker.write_text("done")
    handler("vf", _verify_entry({"type": "file_exists", "path": str(marker)}))
    assert runner.main(["--handler", "vf", "--mode", "auto"]) == 0


def test_verification_is_skipped_in_dry_run(handler, tmp_path):
    handler("vf", _verify_entry({"type": "file_exists", "path": str(tmp_path / "never.txt")}))
    assert runner.main(["--handler", "vf", "--mode", "dry-run"]) == 0


def test_unknown_verify_type_fails_closed_through_the_runner(handler):
    handler("vf", _verify_entry({"type": "mystery"}))
    assert runner.main(["--handler", "vf", "--mode", "auto"]) == runner.EXIT_VERIFY_FAILED
