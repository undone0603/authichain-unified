"""Security regression checks for AgentZ MCP HTTP authentication."""
import asyncio
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
