"""
agentz.api.sse
--------------
Server-Sent Events (SSE) endpoints for real-time monitoring of the
Launch Governor, fleet state, and launch score.

SSE is the simplest protocol for streaming updates from the server to
the browser without WebSocket complexity. Each endpoint sends a
text/event-stream with named events.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger("agentz.api.sse")
router = APIRouter(prefix="/launch/sse", tags=["SSE"])

LOGS_DIR = Path(__file__).resolve().parents[1] / "logs"
GOVERNOR_LOG = LOGS_DIR / "governor_cycles.jsonl"
SCORE_LOG = LOGS_DIR / "launch_scores.jsonl"
ESCALATION_LOG = LOGS_DIR / "escalations.jsonl"


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _tail_jsonl(path: Path, poll_interval: float = 1.0) -> AsyncGenerator[str, None]:
    offset = path.stat().st_size if path.exists() else 0
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()
    while True:
        if path.exists():
            current_size = path.stat().st_size
            if current_size < offset:
                offset = 0
            if current_size > offset:
                with path.open("r", encoding="utf-8") as f:
                    f.seek(offset)
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            yield _sse_event("data", json.loads(line))
                        except json.JSONDecodeError:
                            continue
                    offset = f.tell()
        await asyncio.sleep(poll_interval)


async def _periodic_snapshot(interval_s: float, max_count: int = 0) -> AsyncGenerator[str, None]:
    from agentz.core.governor import LaunchGovernor
    from agentz.core.modes import Mode
    count = 0
    while True:
        try:
            governor = LaunchGovernor(mode=Mode.DRY_RUN)
            fleet = governor.assess_fleet()
            yield _sse_event("fleet_state", {
                "generated_at": fleet.generated_at,
                "total_workflows": fleet.total_workflows,
                "healthy": len(fleet.healthy),
                "degraded": len(fleet.degraded),
                "failing": len(fleet.failing),
                "idle": len(fleet.idle),
                "failing_workflows": fleet.failing[:10],
                "degraded_workflows": fleet.degraded[:10],
            })
        except Exception as e:
            yield _sse_event("error", {"message": str(e)})
        count += 1
        if max_count and count >= max_count:
            break
        await asyncio.sleep(interval_s)


def _verify_token_query(request: Request) -> None:
    from agentz.core.credentials import get
    admin_token = get("agent_secret", required=False) or os.environ.get("AGENT_SECRET", "")
    token = request.query_params.get("token", "")
    if not token or token != admin_token:
        raise HTTPException(status_code=401, detail="Unauthorized: missing or invalid token")


@router.get("/cycle")
async def sse_governor_cycles(request: Request):
    _verify_token_query(request)
    poll = float(request.query_params.get("poll", "1.0"))
    async def stream():
        yield ": connected\n\n"
        async for event in _tail_jsonl(GOVERNOR_LOG, poll_interval=poll):
            yield event
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})


@router.get("/score")
async def sse_launch_scores(request: Request):
    _verify_token_query(request)
    poll = float(request.query_params.get("poll", "1.0"))
    async def stream():
        yield ": connected\n\n"
        async for event in _tail_jsonl(SCORE_LOG, poll_interval=poll):
            yield event
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


@router.get("/escalations")
async def sse_escalations(request: Request):
    _verify_token_query(request)
    poll = float(request.query_params.get("poll", "1.0"))
    async def stream():
        yield ": connected\n\n"
        async for event in _tail_jsonl(ESCALATION_LOG, poll_interval=poll):
            yield event
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


@router.get("/fleet")
async def sse_fleet_snapshots(request: Request):
    _verify_token_query(request)
    interval = float(request.query_params.get("interval", "10"))
    count = int(request.query_params.get("count", "0"))
    async def stream():
        yield ": connected\n\n"
        async for event in _periodic_snapshot(interval_s=interval, max_count=count):
            yield event
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


@router.get("/all")
async def sse_all_events(request: Request):
    _verify_token_query(request)
    poll = float(request.query_params.get("poll", "1.0"))
    fleet_interval = float(request.query_params.get("fleet_interval", "10"))
    async def stream():
        yield ": connected\n\n"
        queue: asyncio.Queue[str] = asyncio.Queue()
        async def producer(gen, event_name):
            try:
                async for data in gen:
                    try:
                        parsed = json.loads(data.split("data: ", 1)[1].strip().rstrip("\n"))
                        await queue.put(f"event: {event_name}\ndata: {json.dumps(parsed)}\n\n")
                    except (json.JSONDecodeError, IndexError):
                        pass
            except Exception as e:
                await queue.put(f"event: error\ndata: {json.dumps({'source': event_name, 'error': str(e)})}\n\n")
        async def fleet_producer():
            try:
                async for event in _periodic_snapshot(fleet_interval):
                    await queue.put(event)
            except Exception as e:
                await queue.put(f"event: error\ndata: {json.dumps({'source': 'fleet', 'error': str(e)})}\n\n")
        tasks = [
            asyncio.create_task(producer(_tail_jsonl(GOVERNOR_LOG, poll), "governor_cycle")),
            asyncio.create_task(producer(_tail_jsonl(SCORE_LOG, poll), "launch_score")),
            asyncio.create_task(producer(_tail_jsonl(ESCALATION_LOG, poll), "escalation")),
            asyncio.create_task(fleet_producer()),
        ]
        try:
            while True:
                yield await queue.get()
        except asyncio.CancelledError:
            pass
        finally:
            for t in tasks:
                t.cancel()
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})


# ── Deployment control-plane endpoint ───────────────────────────────────────
# This router is already mounted by agentz.api.main, so the control plane is
# exposed without changing the main FastAPI bootstrap. Reads are fail-closed:
# missing provider credentials become explicit "unavailable" states.
@router.get("/control-plane/state", tags=["Control Plane"])
async def deployment_control_plane_state(request: Request):
    _verify_token_query(request)
    from agentz.control_plane import collect_state
    return collect_state()
