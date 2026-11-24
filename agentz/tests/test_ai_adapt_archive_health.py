"""ai_adapt_archive_health reads only, fails closed, and grades the archive state."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import ai_adapt_archive_health as h

NOW = datetime(2026, 11, 6, 12, 0, tzinfo=UTC)


def ago(**kw) -> str:
    return (NOW - timedelta(**kw)).isoformat()


def item(key="paper:1", **over):
    row = {"item_key": key, "availability": "available", "last_checked_at": ago(hours=6),
           "receipts": {"watch": {"unchecked_streak": 0}}}
    row.update(over)
    return row


LOG_OK = [{"bot": "ai-adapt-archive", "run_at": ago(hours=5), "status": "ok"}]


def kinds(result):
    return [f["kind"] for f in result["findings"]]


def test_healthy_archive_is_green():
    r = h.evaluate([item(), item("code:2")], LOG_OK, NOW)
    assert r["status"] == "green"
    assert r["counts"]["items"] == 2
    assert r["findings"] == []


def test_silent_archive_bot_is_red():
    old = [{"bot": "ai-adapt-archive", "run_at": ago(hours=37), "status": "ok"}]
    assert h.evaluate([item()], old, NOW)["status"] == "red"
    r = h.evaluate([item()], [], NOW)
    assert r["status"] == "red" and kinds(r) == ["archive_silent"]


def test_recent_heartbeat_fail_is_red_and_old_one_is_not():
    fired = LOG_OK + [{"bot": "ai-adapt-heartbeat", "run_at": ago(hours=2), "status": "fail"}]
    assert kinds(h.evaluate([item()], fired, NOW)) == ["heartbeat_fired"]
    old = LOG_OK + [{"bot": "ai-adapt-heartbeat", "run_at": ago(hours=30), "status": "fail"}]
    assert h.evaluate([item()], old, NOW)["status"] == "green"


def test_watch_streaks_unavailable_stale_and_swh_are_warnings():
    rows = [
        item("a", receipts={"watch": {"unchecked_streak": 3}}),
        item("b", receipts={"watch": {"unchecked_streak": 9}}),
        item("c", availability="removed"),
        item("d", last_checked_at=ago(days=9)),
        item("e", receipts={"swh_retry": {"count": 3}}),
    ]
    r = h.evaluate(rows, LOG_OK, NOW)
    assert r["status"] == "warn"
    assert sorted(kinds(r)) == ["dead_host", "stale", "swh_retry_exhausted", "unavailable", "watch_alert"]
    assert r["counts"] == {"items": 5, "unavailable": 1, "alert": 1, "dead": 1, "stale": 1, "swh_exhausted": 1}


def test_malformed_rows_do_not_crash_or_count_as_runs():
    rows = [{"item_key": None}, item("x", receipts="not-a-dict", last_checked_at="garbage")]
    logs = [{"bot": "ai-adapt-archive", "run_at": "not a date"}, {}]
    r = h.evaluate(rows, logs, NOW)
    assert r["counts"]["items"] == 1
    assert "archive_silent" in kinds(r) and "stale" in kinds(r)


def test_fetch_is_get_only_on_the_two_tables():
    calls = []

    def fake_get(url, headers, params):
        calls.append((url, headers, params))
        return []

    h.fetch("https://x.supabase.co/", "k", NOW, fake_get)
    assert [c[0] for c in calls] == [
        "https://x.supabase.co/rest/v1/ai_adapt_archive",
        "https://x.supabase.co/rest/v1/ops_bot_log",
    ]
    assert calls[0][1]["apikey"] == "k"
    assert calls[1][2]["bot"] == "in.(ai-adapt-archive,ai-adapt-heartbeat)"
    assert calls[1][2]["run_at"] == "gte." + ago(hours=36)


def test_check_fails_closed_without_leaking_error_text():
    assert h.check(None, None, NOW)["status"] == "unverified"

    def boom(url, headers, params):
        raise RuntimeError("ECONNRESET https://x.supabase.co?apikey=secret-key")

    r = h.check("https://x.supabase.co", "secret-key", NOW, boom)
    assert r == {"status": "unverified", "findings": [], "counts": {}, "detail": "read failed"}

    def denied(url, headers, params):
        raise RuntimeError("HTTP 401")

    assert h.check("https://x.supabase.co", "k", NOW, denied)["detail"] == "HTTP 401"


def test_run_saves_state_and_raises_on_unverified(tmp_path, monkeypatch):
    monkeypatch.setattr("agentz.core.modes.CHECKPOINT_DIR", tmp_path)
    monkeypatch.setattr("agentz.core.credentials.get", lambda key, required=True: None)
    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="ai_adapt_archive_health", verbose=False)
    with pytest.raises(RuntimeError, match="unverified"):
        h.run(ctx)
    assert ctx.load_state()["status"] == "unverified"


def test_run_returns_green_summary(tmp_path, monkeypatch):
    monkeypatch.setattr("agentz.core.modes.CHECKPOINT_DIR", tmp_path)
    monkeypatch.setattr("agentz.core.credentials.get", lambda key, required=True: "v")
    monkeypatch.setattr(h, "check", lambda url, key: h.evaluate([item()], LOG_OK, NOW))
    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="ai_adapt_archive_health", verbose=False)
    assert h.run(ctx) == "ai_adapt archive health: green (1 items)"
