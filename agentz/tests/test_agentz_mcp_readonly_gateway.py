"""Security regression checks for AgentZ MCP HTTP authentication."""
import os
from unittest.mock import patch

import pytest

from agentz.mcp_readonly_gateway import BearerGuard, create_app


async def request(app, headers=None):
    messages = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    await app({"type": "http", "method": "POST", "path": "/mcp",
               "headers": headers or []}, receive, send)
    return messages


@pytest.mark.asyncio
async def test_anonymous_and_wrong_tokens_rejected():
    async def downstream(scope, receive, send):
        raise AssertionError("unauthorized request reached MCP")
    app = BearerGuard(downstream, "x" * 40)
    for headers in ([], [(b"authorization", b"Bearer wrong")]):
        result = await request(app, headers)
        assert result[0]["status"] == 401


@pytest.mark.asyncio
async def test_browser_origin_rejected_even_with_valid_token():
    async def downstream(scope, receive, send):
        raise AssertionError("browser-origin request reached MCP")
    app = BearerGuard(downstream, "x" * 40)
    result = await request(app, [(b"authorization", b"Bearer " + b"x" * 40),
                                 (b"origin", b"https://evil.example")])
    assert result[0]["status"] == 401


def test_gateway_refuses_missing_or_short_secret():
    for value in ("", "short"):
        with patch.dict(os.environ, {"AGENTZ_MCP_GATEWAY_TOKEN": value}):
            with pytest.raises(RuntimeError):
                create_app()

@pytest.mark.asyncio
async def test_authorized_request_reaches_readonly_app():
    async def downstream(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})
    app = BearerGuard(downstream, "x" * 40)
    result = await request(app, [(b"authorization", b"Bearer " + b"x" * 40)])
    assert result[0]["status"] == 200


@pytest.mark.asyncio
async def test_duplicate_authorization_and_mixed_case_origin_fail_closed():
    async def downstream(scope, receive, send):
        raise AssertionError("unsafe request reached MCP")
    app = BearerGuard(downstream, "x" * 40)
    valid = (b"authorization", b"Bearer " + b"x" * 40)
    for headers in ([valid, valid], [valid, (b"Origin", b"https://evil.example")]):
        result = await request(app, headers)
        assert result[0]["status"] == 401


def test_browser_subprocess_does_not_inherit_gateway_token(tmp_path, monkeypatch):
    """No browser child may receive the MCP bearer token."""
    from types import SimpleNamespace
    from agentz.core import browser_executor, capability_policy
    browser_bin = tmp_path / "dummy-browser"
    browser_bin.write_text("stub")
    evidence_dir = tmp_path / "evidence"
    evidence_dir.mkdir(mode=0o700)
    monkeypatch.setenv("AGENTZ_BROWSER_BIN", str(browser_bin))
    monkeypatch.setenv("AGENTZ_BROWSER_EVIDENCE_DIR", str(evidence_dir))
    monkeypatch.setenv("AGENTZ_MCP_GATEWAY_TOKEN", "x" * 40)
    monkeypatch.setattr(capability_policy, "decide", lambda _: SimpleNamespace(allowed=True))
    observed = []
    def fake_run(argv, *, env, **kwargs):
        observed.append((argv, env))
        return SimpleNamespace(returncode=0, stdout="read-only snapshot", stderr="")
    monkeypatch.setattr(browser_executor.subprocess, "run", fake_run)
    result = browser_executor.execute_browser_task("github-main-protection-inspect")
    assert result["verified"] is False
    assert len(observed) == 3
    assert all("AGENTZ_MCP_GATEWAY_TOKEN" not in env for _, env in observed)
    assert all(env["AGENT_BROWSER_SESSION"].startswith("agentz-") for _, env in observed)
