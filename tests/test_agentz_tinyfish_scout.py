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


def test_discovered_private_and_control_character_urls_refused():
    assert _public_references({
        "structured_content": {"results": [
            {"url": "https://127.0.0.1/private"},
            {"url": "https://169.254.169.254/metadata"},
            {"url": "https://2130706433/private"},
            {"url": "https://foo.internal/data"},
            {"url": "https://example.org/unsafe\\nheader"},
            {"url": "https://example.org/clean?token=not-recorded"},
        ]}
    }) == ["https://example.org/clean"]


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


def _run_daemon_cycle(monkeypatch, *, enabled: bool, has_key: bool, state_dir=None):
    """Execute exactly one daemon loop with fake process and clock."""
    import signal
    from types import SimpleNamespace
    from agentz import daemon

    calls = []
    if state_dir is None:
        monkeypatch.delenv("AGENTZ_TINYFISH_SCOUT_STATE_DIR", raising=False)
    else:
        monkeypatch.setenv("AGENTZ_TINYFISH_SCOUT_STATE_DIR", str(state_dir))
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


def test_daemon_opt_in_dispatch_is_read_only_and_targeted(monkeypatch, tmp_path):
    calls = _run_daemon_cycle(monkeypatch, enabled=True, has_key=True, state_dir=tmp_path)
    assert len(calls) == 2
    assert "govchain_grant_proposal" in calls[0]
    assert "dry-run" in calls[0]
    assert "tinyfish_a2a_scout" in calls[1]
    assert "confirm" in calls[1]
    assert "auto" not in calls[1]




def test_enabled_daemon_refuses_without_persistent_state_dir(monkeypatch):
    calls = _run_daemon_cycle(monkeypatch, enabled=True, has_key=True)
    assert len(calls) == 1


def test_restart_does_not_repeat_daily_scout(monkeypatch, tmp_path):
    first = _run_daemon_cycle(
        monkeypatch, enabled=True, has_key=True, state_dir=tmp_path,
    )
    second = _run_daemon_cycle(
        monkeypatch, enabled=True, has_key=True, state_dir=tmp_path,
    )
    assert len(first) == 2
    assert len(second) == 1
    markers = list(tmp_path.glob("tinyfish-a2a-scout-*.claimed"))
    assert len(markers) == 1
    assert markers[0].stat().st_mode & 0o777 == 0o600


def test_scout_slot_is_atomic_between_processes(monkeypatch, tmp_path):
    from agentz import daemon
    monkeypatch.setenv("AGENTZ_TINYFISH_SCOUT_STATE_DIR", str(tmp_path))
    assert daemon._claim_daily_scout_slot() is True
    assert daemon._claim_daily_scout_slot() is False


def test_nonexistent_state_dir_fails_closed(monkeypatch, tmp_path):
    from agentz import daemon
    monkeypatch.setenv(
        "AGENTZ_TINYFISH_SCOUT_STATE_DIR", str(tmp_path / "not-mounted"),
    )
    assert daemon._claim_daily_scout_slot() is False

def test_scout_masks_secret_bearing_transport_failure(monkeypatch):
    import agentz.integrations.tinyfish_mcp as adapter

    async def fake_call(_action, _values):
        raise OSError("Authorization: Bearer private-key-do-not-log")

    monkeypatch.setenv("TINYFISH_API_KEY", "private-key-do-not-log")
    monkeypatch.setattr(adapter, "call_tinyfish", fake_call)
    with pytest.raises(RuntimeError) as captured:
        run(Context(Mode.CONFIRM))
    assert "private-key-do-not-log" not in str(captured.value)
    assert str(captured.value) == "TinyFish scout transport failed"
    assert captured.value.__cause__ is None
