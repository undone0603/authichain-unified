"""Loopback-only mock MCP server for AgentZ performance benchmarks.

Serves JSON-RPC `tools/list` and `tools/call` for the hosted tool names in the
capability registry, with read-only annotations and a fixed simulated I/O
latency. It never calls a real service. Bind is forced to 127.0.0.1.

    python -m agentz.bench.mock_mcp_server --port 8765 --latency-ms 20 --fail-rate 0
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

RO = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}
OBJ = {"type": "object"}
TOOLS = [
    {"name": "get_pricing", "annotations": RO, "inputSchema": {"type": "object", "properties": {}}},
    {"name": "query_provenance", "annotations": RO,
     "inputSchema": {"type": "object", "required": ["assetId"],
                     "properties": {"assetId": {"type": "string"}}}},
    {"name": "verify_attestation", "annotations": RO,
     "inputSchema": {"type": "object", "required": ["assetId"],
                     "properties": {"assetId": {"type": "string"},
                                    "expectedObjectId": {"type": "string"}}}},
    {"name": "verify_record", "annotations": RO, "inputSchema": OBJ},
    {"name": "dpp_readiness_check", "annotations": RO,
     "inputSchema": {"type": "object", "required": ["category"],
                     "properties": {"category": {"type": "string"},
                                    "sells_in_eu": {"type": "boolean"}}}},
    {"name": "scan_living_qr", "annotations": RO,
     "inputSchema": {"type": "object", "required": ["object_id"],
                     "properties": {"object_id": {"type": "string"}}}},
    {"name": "negotiate", "annotations": RO,
     "inputSchema": {"type": "object", "required": ["service"],
                     "properties": {"service": {"type": "string"}}}},
    {"name": "verify", "annotations": {"readOnlyHint": False, "destructiveHint": True},
     "inputSchema": OBJ},
]


def build_app(latency_ms: float, fail_rate: float, seed: int = 7) -> Starlette:
    rng = random.Random(seed)
    stats = {"calls": 0, "lists": 0, "failed": 0}

    async def mcp(request: Request) -> JSONResponse:
        body = await request.json()
        method = body.get("method")
        if method == "tools/list":
            stats["lists"] += 1
            return JSONResponse({"jsonrpc": "2.0", "id": body.get("id"), "result": {"tools": TOOLS}})
        if method == "tools/call":
            stats["calls"] += 1
            await asyncio.sleep(latency_ms / 1000)
            if fail_rate and rng.random() < fail_rate:
                stats["failed"] += 1
                return JSONResponse({"error": "injected"}, status_code=503)
            params = body.get("params") or {}
            payload = {"tool": params.get("name"), "echo": params.get("arguments"), "ok": True}
            return JSONResponse({"jsonrpc": "2.0", "id": body.get("id"),
                                 "result": {"content": [{"type": "text", "text": json.dumps(payload)}]}})
        return JSONResponse({"jsonrpc": "2.0", "id": body.get("id"),
                             "error": {"code": -32601, "message": "method not found"}})

    async def stats_route(_request: Request) -> JSONResponse:
        return JSONResponse(stats)

    return Starlette(routes=[Route("/mcp", mcp, methods=["POST"]),
                             Route("/stats", stats_route, methods=["GET"])])


def main() -> None:
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--latency-ms", type=float, default=20.0)
    ap.add_argument("--fail-rate", type=float, default=0.0)
    a = ap.parse_args()
    uvicorn.run(build_app(a.latency_ms, a.fail_rate), host="127.0.0.1", port=a.port,
                log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
