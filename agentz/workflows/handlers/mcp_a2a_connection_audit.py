"""Audit-only MCP/A2A setup connection preflight for AgentZ.

The probe can connect ONLY to the public AuthiChain origin.
It sends read-only MCP initialize + tools/list and GET Agent Card.
It cannot call business tools, send A2A messages, sign, pay, or contact a peer.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess

from agentz.core.modes import Mode, ExecutionContext

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PROBE = PROJECT_ROOT / "tools" / "agent-connections" / "probe.mjs"


def run(ctx: ExecutionContext) -> str:
    if ctx.mode == Mode.DRY_RUN:
        return (
            "DRY_RUN: would read AuthiChain MCP initialize/tools/list and its "
            "public A2A Agent Card only; no third-party connection or money movement"
        )
    if not PROBE.is_file():
        raise FileNotFoundError("MCP/A2A connection probe unavailable")
    result = subprocess.run(
        ["node", str(PROBE)],
        capture_output=True,
        text=True,
        timeout=40,
        check=False,
    )
    if result.returncode != 0:
        # Never echo remote response bodies or any accidental sensitive data.
        raise RuntimeError("MCP/A2A connection preflight failed or needs review")
    report = json.loads(result.stdout)
    mcp = report.get("mcp", {}).get("technical_status", "unknown")
    a2a = report.get("a2a", {}).get("technical_status", "unknown")
    if report.get("connection") != "AUTHICHAIN_ENDPOINTS_ONLY_NOT_EXTERNAL_PEER_CONNECTED":
        raise RuntimeError("Connection boundary mismatch")
    if report.get("permissions", {}).get("payment") is not False:
        raise RuntimeError("Unexpected payment permission")
    return (
        f"READ_ONLY_CONNECTION_PREFLIGHT: mcp={mcp} a2a={a2a} "
        "external_peers_connected=0 paid_calls=0"
    )
