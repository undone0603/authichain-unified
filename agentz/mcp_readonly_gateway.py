"""Loopback-only, bearer-authenticated read-only AgentZ MCP gateway.

Run behind a separately authenticated TLS reverse proxy; never bind publicly.
Only fixed, allowlisted browser inspections are exported.
"""
import hmac
import os

import uvicorn
from mcp.server.fastmcp import FastMCP

from agentz.core.browser_executor import execute_browser_task

mcp = FastMCP("AgentZ Read-Only Browser", stateless_http=True, json_response=True)


@mcp.tool()
def browser_inspect(task: str) -> dict:
    """Inspect one of the fixed GitHub tasks defined in browser_executor."""
    return execute_browser_task(task)


@mcp.tool()
def readiness() -> dict:
    """Report non-secret readiness; does not certify host isolation."""
    from pathlib import Path
    browser = os.environ.get("AGENTZ_BROWSER_BIN", "")
    evidence = os.environ.get("AGENTZ_BROWSER_EVIDENCE_DIR", "")
    return {
        "browser_binary_present": bool(browser and Path(browser).is_file()),
        "private_evidence_directory_present": bool(
            evidence and Path(evidence).is_dir()
            and (Path(evidence).stat().st_mode & 0o077) == 0
        ),
        "production_dispatch_available": False,
    }


class BearerGuard:
    def __init__(self, app, token: str):
        self.app = app
        self.token = token.encode("utf-8")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = scope.get("headers", [])
        auth_values = [value for name, value in headers if name.lower() == b"authorization"]
        origin_present = any(name.lower() == b"origin" for name, _ in headers)
        expected = b"Bearer " + self.token
        if (len(auth_values) != 1
                or not hmac.compare_digest(auth_values[0], expected)
                or origin_present):
            await send({"type": "http.response.start", "status": 401,
                        "headers": [(b"content-type", b"text/plain"),
                                    (b"cache-control", b"no-store")]})
            await send({"type": "http.response.body", "body": b"Unauthorized"})
            return
        await self.app(scope, receive, send)


def create_app():
    token = os.environ.get("AGENTZ_MCP_GATEWAY_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("AGENTZ_MCP_GATEWAY_TOKEN must be a strong secret")
    return BearerGuard(mcp.streamable_http_app(), token)


if __name__ == "__main__":
    # Loopback only. An authenticated TLS proxy must be configured separately.
    uvicorn.run(create_app(), host="127.0.0.1", port=8765,
                proxy_headers=False, server_header=False)
