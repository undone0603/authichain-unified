"""Read-only TinyFish MCP adapter for AgentZ.

Uses the owner's stdio MCP bridge: npx -y mcp-remote https://agent.tinyfish.ai/mcp.
This adapter intentionally exposes only search and fetch_content. It does not
enable browser automations, wallet charges, outreach, or production sends.
OAuth state is managed by mcp-remote on the AgentZ host, not by this repository.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import shutil
from typing import Any
from urllib.parse import urlsplit

MCP_ENDPOINT = "https://agent.tinyfish.ai/mcp"
READ_ONLY_TOOLS = frozenset({"search", "fetch_content"})
MAX_FETCH_URLS = 10


def public_url(url: str) -> str:
    """Reject local/private targets before handing URLs to a remote fetcher."""
    parsed = urlsplit(url)
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        raise ValueError("TinyFish fetch requires an absolute HTTP(S) URL")
    if parsed.username or parsed.password:
        raise ValueError("URLs with embedded credentials are not permitted")
    host = parsed.hostname.lower().rstrip(".")
    if host in {"localhost", "metadata.google.internal"} or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("Private/local hosts are not permitted")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        if not address.is_global:
            raise ValueError("Private/non-global IP addresses are not permitted")
    return url


def request_for(action: str, values: list[str]) -> dict[str, Any]:
    """Build only the permitted read-only tool arguments."""
    if action == "search":
        if len(values) != 1 or not values[0].strip():
            raise ValueError("search requires exactly one nonempty query")
        if len(values[0]) > 2000:
            raise ValueError("query too long")
        return {
            "query": values[0].strip(),
            "purpose": "AgentZ read-only research with verifiable source URLs",
        }
    if action == "fetch_content":
        if not 1 <= len(values) <= MAX_FETCH_URLS:
            raise ValueError("fetch_content requires 1 to 10 URLs")
        return {
            "urls": [public_url(v) for v in values],
            "purpose": "AgentZ read-only extraction of user-supplied public documents",
            "format": "markdown",
            "links": False,
            "image_links": False,
            "iframe_links": False,
            "page_metadata": False,
        }
    raise ValueError("TinyFish action is not in the read-only allowlist")


async def call_tinyfish(action: str, values: list[str]) -> dict[str, Any]:
    """Initialize MCP, check server-advertised tools, call exactly one tool."""
    args = request_for(action, values)
    if shutil.which("npx") is None:
        raise RuntimeError("npx is missing; install Node.js on the AgentZ host")
    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError as exc:
        raise RuntimeError("Python MCP SDK missing; install mcp>=1.12,<2") from exc

    params = StdioServerParameters(
        command="npx",
        args=["-y", "mcp-remote", MCP_ENDPOINT],
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            available = {tool.name for tool in (await session.list_tools()).tools}
            if action not in available:
                raise RuntimeError(f"TinyFish did not advertise {action!r}")
            result = await session.call_tool(action, args)
            return {
                "tool": action,
                "ok": not result.isError,
                "structured_content": getattr(result, "structuredContent", None),
                "content": [
                    getattr(part, "text", "")
                    for part in result.content
                    if getattr(part, "type", None) == "text"
                ],
            }


def cli_action(action: str, values: list[str], *, dry_run: bool = False) -> int:
    """CLI boundary: no network or auth on dry-run; JSON output for orchestration."""
    try:
        args = request_for(action, values)
        if dry_run:
            print(json.dumps({
                "mode": "dry-run",
                "endpoint": MCP_ENDPOINT,
                "bridge": ["npx", "-y", "mcp-remote", MCP_ENDPOINT],
                "tool": action,
                "arguments": args,
            }, indent=2))
            return 0
        result = asyncio.run(call_tinyfish(action, values))
        print(json.dumps(result, indent=2, default=str))
        return 0 if result["ok"] else 1
    except (ValueError, RuntimeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1
