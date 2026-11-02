"""Opt-in AgentZ read-only MCP HTTPX transport diagnostic, never tool execution."""
from __future__ import annotations

import asyncio
import os

from agentz.core.modes import Mode
from agentz.integrations.mcp_httpx_probe import ENDPOINT, probe


def run(ctx):
    """No network unless both auto mode and explicit environment gate are set."""
    if ctx.mode != Mode.AUTO or os.environ.get("AGENTZ_HTTPX_MCP_LIVE") != "true":
        return {
            "state": "dry_run",
            "target": ENDPOINT,
            "network_called": False,
            "requirements": "--mode auto plus AGENTZ_HTTPX_MCP_LIVE=true",
            "payment": False,
        }
    return asyncio.run(probe())
