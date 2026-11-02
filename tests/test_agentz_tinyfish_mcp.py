"""Offline tests for AgentZ's fail-closed TinyFish MCP integration."""

import json

import pytest

from agentz.integrations.tinyfish_mcp import cli_action, public_url, request_for


def test_search_is_read_only_and_bounded():
    call = request_for("search", ["A2A protocol"])
    assert call["query"] == "A2A protocol"
    assert "automation" not in call
    with pytest.raises(ValueError):
        request_for("search", [""])
    with pytest.raises(ValueError):
        request_for("search", ["x" * 2001])


def test_fetch_arguments_are_read_only():
    call = request_for("fetch_content", ["https://github.com/a2aproject/A2A"])
    assert call["urls"] == ["https://github.com/a2aproject/A2A"]
    assert call["format"] == "markdown"
    assert call["links"] is False
    with pytest.raises(ValueError):
        request_for("fetch_content", [])
    with pytest.raises(ValueError):
        request_for("fetch_content", ["https://example.com"] * 11)


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/private",
    "http://10.0.0.1/private",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/private",
    "http://localhost",
    "http://127.1/private",
    "http://0177.0.0.1/private",
    "http://2130706433/private",
    "http://0x7f000001/private",
    "https://foo.internal",
    "https://x.local",
    "https://user:pass@example.com",
    "file:///etc/passwd",
])
def test_private_and_unsafe_urls_refused(url):
    with pytest.raises(ValueError):
        public_url(url)


def test_unlisted_actions_refused():
    with pytest.raises(ValueError):
        request_for("run_web_automation", ["https://example.com"])
    with pytest.raises(ValueError):
        request_for("create_monitor", ["https://example.com"])


def test_dry_run_has_no_network_or_process(capsys, monkeypatch):
    monkeypatch.delenv("TINYFISH_API_KEY", raising=False)
    monkeypatch.setenv("PATH", "")
    assert cli_action("search", ["Agent2Agent spec"], dry_run=True) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["mode"] == "dry-run"
    assert output["tool"] == "search"
    assert output["bridge"][0] == "npx"


def test_invalid_fetch_fails_closed_without_network(capsys):
    assert cli_action("fetch_content", ["http://localhost"], dry_run=False) == 1
    assert json.loads(capsys.readouterr().out)["ok"] is False


def test_transport_exception_is_sanitized(capsys, monkeypatch):
    async def broken_connection(_action, _values):
        raise OSError("Authorization: Bearer should-not-appear")

    monkeypatch.setattr("agentz.integrations.tinyfish_mcp.call_tinyfish", broken_connection)
    assert cli_action("search", ["Agent2Agent"], dry_run=False) == 1
    output = json.loads(capsys.readouterr().out)
    assert output["error"] == "TinyFish MCP connection failed"
    assert "should-not-appear" not in str(output)


def test_headless_mode_dry_run_hides_key(capsys, monkeypatch):
    monkeypatch.setenv("TINYFISH_API_KEY", "sk-tinyfish-private-do-not-log")
    monkeypatch.setenv("PATH", "")
    assert cli_action("search", ["Agent2Agent"], dry_run=True) == 0
    output = capsys.readouterr().out
    assert "sk-tinyfish-private-do-not-log" not in output
    assert json.loads(output)["connection"] == "api-key-http"
