"""Regression: AgentZ schedulers must see blocked workflows as failures."""
from argparse import Namespace
from types import SimpleNamespace

from agentz import cli


def _args():
    return Namespace(
        mode="confirm",
        quiet=True,
        json_out=None,
        all=False,
        workflow_id="tinyfish_a2a_scout",
    )


def _setup(monkeypatch, status):
    monkeypatch.setattr(cli, "_selected_workflows", lambda _args: [object()])
    monkeypatch.setattr(
        cli,
        "execute",
        lambda *_args, **_kwargs: SimpleNamespace(
            status=status, notes="simulated", error=None
        ),
    )
    monkeypatch.setattr(cli, "write_audit_log", lambda *_args, **_kwargs: None)


def test_blocked_workflow_is_nonzero(monkeypatch):
    _setup(monkeypatch, "blocked")
    assert cli.cmd_run(_args()) == 1


def test_failed_workflow_is_nonzero(monkeypatch):
    _setup(monkeypatch, "failed")
    assert cli.cmd_run(_args()) == 1


def test_successful_workflow_is_zero(monkeypatch):
    _setup(monkeypatch, "ok")
    assert cli.cmd_run(_args()) == 0


def test_dry_run_skip_remains_zero(monkeypatch):
    _setup(monkeypatch, "skipped")
    assert cli.cmd_run(_args()) == 0
