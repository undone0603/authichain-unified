"""Offline safety checks for the AgentZ read-only A2A scout."""
import json

import pytest

from agentz.core.modes import Mode
from agentz.workflows.handlers.tinyfish_a2a_scout import (
    _public_references,
    run,
)


class Context:
    def __init__(self, mode):
        self.mode = mode
        self.verbose = False
        self.state = None

    def save_state(self, data):
        self.state = data


def test_dry_run_never_requires_auth_or_calls_network(monkeypatch):
    monkeypatch.delenv("TINYFISH_API_KEY", raising=False)
    assert "no network" in run(Context(Mode.DRY_RUN)).lower()


def test_live_requires_key_before_ever_connecting(monkeypatch):
    monkeypatch.delenv("TINYFISH_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="missing"):
        run(Context(Mode.CONFIRM))


def test_only_https_source_links_are_printable():
    content = {
        "results": [
            {"url": "https://github.com/a2aproject/a2a", "title": "A2A"},
            {"url": "javascript:alert(1)"},
            {"url": "http://localhost/"},
            {"url": "https://user:secret@example.com/"},
            {"url": "https://github.com/a2aproject/a2a"},
            {"url": "https://example.org/example"},
        ]
    }
    refs = _public_references({
        "structured_content": content,
        "content": [json.dumps(content)],
    })
    assert refs == ["https://github.com/a2aproject/a2a", "https://example.org/example"]


def test_strips_query_tokens_from_source_url():
    assert _public_references({
        "structured_content": {
            "results": [{"url": "https://example.org/agent?secret=never-log#fragment"}]
        }
    }) == ["https://example.org/agent"]


def test_malformed_untrusted_output_does_not_crash():
    assert _public_references({
        "content": ["this is not JSON", "[null]", '{"results":"bad"}'],
    }) == []


def test_success_response_reports_count_without_sending(monkeypatch):
    import agentz.integrations.tinyfish_mcp as adapter

    async def fake_call(action, values):
        assert action == "search"
        assert len(values) == 1
        return {
            "ok": True,
            "structured_content": {
                "results": [{"url": "https://github.com/a2aproject/a2a"}]
            },
            "content": [],
        }
    monkeypatch.setenv("TINYFISH_API_KEY", "dummy-test-key")
    monkeypatch.setattr(adapter, "call_tinyfish", fake_call)
    ctx = Context(Mode.CONFIRM)
    result = run(ctx)
    assert ctx.state["tool"] == "tinyfish.search"
    assert ctx.state["verification"] == "unverified"
    assert ctx.state["sources"] == ["https://github.com/a2aproject/a2a"]
    assert "observed_at_utc" in ctx.state
    assert "references=1" in result
    assert "no outreach or payments" in result


def test_api_failure_is_fail_closed(monkeypatch):
    import agentz.integrations.tinyfish_mcp as adapter

    async def fake_call(_action, _values):
        return {"ok": False}
    monkeypatch.setenv("TINYFISH_API_KEY", "dummy-test-key")
    monkeypatch.setattr(adapter, "call_tinyfish", fake_call)
    with pytest.raises(RuntimeError, match="search failed"):
        run(Context(Mode.CONFIRM))


def _run_daemon_cycle(monkeypatch, *, enabled: bool, has_key: bool):
    """Execute exactly one daemon loop with fake process and clock."""
    import signal
    from types import SimpleNamespace
    from agentz import daemon

    calls = []
    monkeypatch.setattr(daemon, "STOP", False)
    monkeypatch.setattr(daemon, "POLL_SECONDS", 300)
    monkeypatch.setattr(daemon.time, "monotonic", lambda: 1000000)
    monkeypatch.setattr(signal, "signal", lambda *_args: None)
    monkeypatch.setattr(
        daemon.time, "sleep",
        lambda _seconds: setattr(daemon, "STOP", True),
    )
    monkeypatch.setattr(
        daemon.subprocess, "run",
        lambda argv, **_kwargs: (
            calls.append(argv) or SimpleNamespace(returncode=0)
        ),
    )
    if enabled:
        monkeypatch.setenv("AGENTZ_TINYFISH_SCOUT_ENABLED", "true")
    else:
        monkeypatch.delenv("AGENTZ_TINYFISH_SCOUT_ENABLED", raising=False)
    if has_key:
        monkeypatch.setenv("TINYFISH_API_KEY", "dummy-test-key")
    else:
        monkeypatch.delenv("TINYFISH_API_KEY", raising=False)

    assert daemon.main() == 0
    return calls


def test_daemon_never_runs_tinyfish_without_explicit_flag(monkeypatch):
    calls = _run_daemon_cycle(monkeypatch, enabled=False, has_key=True)
    assert len(calls) == 1
    assert "govchain_grant_proposal" in calls[0]


def test_daemon_never_runs_tinyfish_without_api_key(monkeypatch):
    calls = _run_daemon_cycle(monkeypatch, enabled=True, has_key=False)
    assert len(calls) == 1
    assert "tinyfish_a2a_scout" not in str(calls)


def test_daemon_opt_in_dispatch_is_read_only_and_targeted(monkeypatch):
    calls = _run_daemon_cycle(monkeypatch, enabled=True, has_key=True)
    assert len(calls) == 2
    assert "govchain_grant_proposal" in calls[0]
    assert "dry-run" in calls[0]
    assert "tinyfish_a2a_scout" in calls[1]
    assert "confirm" in calls[1]
    assert "auto" not in calls[1]
