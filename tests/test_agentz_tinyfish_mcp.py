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


@pytest.mark.parametrize("url", [
    "https://example.com/path\nheader",
    "https://example.com/path\rheader",
    "https://example.com\tadmin",
    "https://example.com/path\x7f",
])
def test_raw_control_characters_refused(url):
    with pytest.raises(ValueError, match="control characters"):
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

def test_headless_transport_uses_http_api_key(monkeypatch):
    import asyncio
    import sys
    import types
    from contextlib import asynccontextmanager
    from agentz.integrations.tinyfish_mcp import tinyfish_transport

    secrets = []

    class FakeHttpClient:
        def __init__(self, *, headers, timeout):
            self.headers = headers
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, _type, _value, _traceback):
            return False

    @asynccontextmanager
    async def fake_streamable_http_client(url, *, http_client):
        secrets.append((url, http_client.headers["Authorization"]))
        yield "read", "write", "session"

    mcp_client = types.ModuleType("mcp.client")
    mcp_http = types.ModuleType("mcp.client.streamable_http")
    mcp_http.streamable_http_client = fake_streamable_http_client
    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", FakeHttpClient)
    monkeypatch.setitem(sys.modules, "mcp", types.ModuleType("mcp"))
    monkeypatch.setitem(sys.modules, "mcp.client", mcp_client)
    monkeypatch.setitem(sys.modules, "mcp.client.streamable_http", mcp_http)
    monkeypatch.setenv("TINYFISH_API_KEY", "test-secret")
    monkeypatch.setenv("PATH", "")

    async def run():
        async with tinyfish_transport() as transport:
            assert transport == ("read", "write")

    asyncio.run(run())
    assert secrets == [("https://agent.tinyfish.ai/mcp", "Bearer test-secret")]

@pytest.mark.parametrize("advertised,expect_failure", [
    ("search", False),
    ("fetch_content", True),
])
def test_session_dispatch_respects_advertised_tools(monkeypatch, advertised, expect_failure):
    import asyncio
    import sys
    import types
    from contextlib import asynccontextmanager
    from agentz import integrations
    from agentz.integrations import tinyfish_mcp

    calls = []

    class FakeSession:
        def __init__(self, _read, _write):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def initialize(self):
            calls.append("initialized")

        async def list_tools(self):
            return types.SimpleNamespace(
                tools=[types.SimpleNamespace(name=advertised)]
            )

        async def call_tool(self, name, args):
            calls.append((name, args))
            return types.SimpleNamespace(
                isError=False,
                structuredContent={"results": [{"url": "https://example.org"}]},
                content=[types.SimpleNamespace(type="text", text='{"ok":true}')],
            )

    @asynccontextmanager
    async def fake_transport():
        yield "read", "write"

    fake_sdk = types.ModuleType("mcp")
    fake_sdk.ClientSession = FakeSession
    monkeypatch.setitem(sys.modules, "mcp", fake_sdk)
    monkeypatch.setattr(tinyfish_mcp, "tinyfish_transport", fake_transport)

    if expect_failure:
        with pytest.raises(RuntimeError, match="did not advertise authorized"):
            asyncio.run(tinyfish_mcp.call_tinyfish("search", ["A2A"]))
        assert calls == ["initialized"]
    else:
        result = asyncio.run(tinyfish_mcp.call_tinyfish("search", ["A2A"]))
        assert result["ok"] is True
        assert result["structured_content"]["results"][0]["url"] == "https://example.org"
        assert calls[0] == "initialized"
        assert calls[1][0] == "search"
        assert calls[1][1]["query"] == "A2A"


def test_session_propagates_server_tool_error_as_failure(monkeypatch):
    import asyncio
    import sys
    import types
    from contextlib import asynccontextmanager
    from agentz.integrations import tinyfish_mcp

    class FakeSession:
        def __init__(self, _read, _write):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def initialize(self):
            pass

        async def list_tools(self):
            return types.SimpleNamespace(
                tools=[types.SimpleNamespace(name="search")]
            )

        async def call_tool(self, _name, _args):
            return types.SimpleNamespace(
                isError=True,
                structuredContent=None,
                content=[types.SimpleNamespace(type="text", text="operation rejected")],
            )

    @asynccontextmanager
    async def fake_transport():
        yield "read", "write"

    fake_sdk = types.ModuleType("mcp")
    fake_sdk.ClientSession = FakeSession
    monkeypatch.setitem(sys.modules, "mcp", fake_sdk)
    monkeypatch.setattr(tinyfish_mcp, "tinyfish_transport", fake_transport)
    result = asyncio.run(tinyfish_mcp.call_tinyfish("search", ["A2A"]))
    assert result["ok"] is False
