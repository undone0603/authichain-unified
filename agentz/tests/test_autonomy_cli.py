"""Tests for the autonomy CLI commands wired into agentz.cli."""

import json

import pytest

from agentz import cli
from agentz.core import autoloop as al
from agentz.core import autonomy_policy as ap

ENTRIES = [
    {"id": "wf_a", "handler": "handlers.wf_a", "priority": "high"},
    {"id": "wf_b", "handler": "handlers.wf_b", "priority": "low", "prerequisites": ["wf_a"]},
    {"id": "send_outreach", "handler": "handlers.send_outreach", "priority": "critical"},
]


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENTZ_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("AGENTZ_KILL_FILE", str(tmp_path / "KILL"))
    monkeypatch.delenv("AGENTZ_KILL_SWITCH", raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(ap, "load_registry", lambda path=None: ENTRIES)


@pytest.fixture
def fake_runner(monkeypatch):
    calls = []

    def fake(policy, mode, timeout=0):
        calls.append((policy.workflow_id, mode))
        return 0

    monkeypatch.setattr(al, "run_via_runner", fake)
    return calls


def test_kill_and_resume_round_trip(capsys):
    assert cli.main(["kill", "--reason", "drill"]) == 0
    assert ap.kill_switch_status()[0] is True
    assert cli.main(["resume"]) == 0
    assert ap.kill_switch_status()[0] is False
    assert cli.main(["resume"]) == 0
    assert "was not engaged" in capsys.readouterr().out


def test_resume_reports_when_the_env_switch_still_holds(monkeypatch, capsys):
    monkeypatch.setenv("AGENTZ_KILL_SWITCH", "1")
    assert cli.main(["resume"]) == 1
    assert "still engaged" in capsys.readouterr().err


def test_approvals_list_approve_reject_lifecycle(capsys):
    assert cli.main(["approvals", "list"]) == 0
    assert "none" in capsys.readouterr().out
    first = ap.request_approval("wf_a", "auto", "needs a human")
    assert cli.main(["approvals", "list"]) == 0
    listed = capsys.readouterr().out
    assert first in listed and "pending" in listed and "wf_a" in listed
    assert cli.main(["approvals", "approve", first, "--note", "ok"]) == 0
    assert ap.consume_approval("wf_a") is True
    assert cli.main(["approvals", "approve", first]) == 1
    second = ap.request_approval("wf_b", "auto", "other")
    assert cli.main(["approvals", "reject", second]) == 0
    assert ap.consume_approval("wf_b") is False


def test_autoloop_requires_a_target(capsys):
    assert cli.main(["autoloop"]) == 2
    assert "needs --workflow" in capsys.readouterr().err


def test_autoloop_dry_run_all_skips_outbound_and_orders_by_dependency(fake_runner, capsys):
    assert cli.main(["autoloop", "--all", "--json"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["mode"] == "dry-run" and out["exit_code"] == 0
    assert fake_runner == [("wf_a", "dry-run"), ("wf_b", "dry-run")]
    skipped = {s["workflow_id"]: s["reason"] for s in out["steps"] if s["status"] == "skipped"}
    assert skipped["send_outreach"].startswith("excluded")


def test_autoloop_auto_is_refused_without_opt_in(fake_runner, capsys):
    assert cli.main(["autoloop", "--mode", "auto", "--all"]) == 2
    assert "refused" in capsys.readouterr().err
    assert cli.main(["autoloop", "--mode", "auto", "--all", "--allow-auto"]) == 2
    assert fake_runner == []
    assert cli.main(["autoloop", "--mode", "auto", "-w", "wf_a", "--allow-auto"]) == 0
    assert fake_runner == [("wf_a", "auto")]


def test_autoloop_halts_under_the_kill_switch(fake_runner, capsys):
    ap.engage_kill_switch("drill")
    assert cli.main(["autoloop", "--all"]) == al.EXIT_KILLED
    assert fake_runner == []


def test_autoloop_policy_unavailable_and_empty_registry(monkeypatch, capsys):
    def boom(path=None):
        raise ap.PolicyUnavailable("no yaml")

    monkeypatch.setattr(ap, "load_registry", boom)
    assert cli.main(["autoloop", "--all"]) == al.EXIT_POLICY
    monkeypatch.setattr(ap, "load_registry", lambda path=None: [])
    assert cli.main(["autoloop", "--all"]) == 2


def test_ledger_command_shows_recent_events(fake_runner, capsys):
    assert cli.main(["ledger"]) == 0
    assert "empty" in capsys.readouterr().out
    cli.main(["autoloop", "-w", "wf_a"])
    capsys.readouterr()
    assert cli.main(["ledger", "--tail", "5"]) == 0
    lines = [json.loads(x) for x in capsys.readouterr().out.splitlines()]
    assert [e["event"] for e in lines] == ["run_start", "step", "run_end"]
