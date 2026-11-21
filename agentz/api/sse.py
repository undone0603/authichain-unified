"""
agentz.api.sse
--------------
Server-Sent Events (SSE) endpoints for real-time monitoring of the
Launch Governor, fleet state, and launch score.

SSE is the simplest protocol for streaming updates from the server to
the browser without WebSocket complexity. Each endpoint sends a
text/event-stream with named events.

Usage from the browser (EventSource cannot set Authorization):
  await fetch('/launch/sse/session', {method:'POST',
      headers:{Authorization:'Bearer SECRET'}, credentials:'include'});
  const es = new EventSource('/launch/sse/cycle', {withCredentials:true});
  es.addEventListener('governor_cycle', (e) => console.log(JSON.parse(e.data)));

  fetch() streams may send Authorization directly and skip the cookie.

Usage from Python:
  import httpx
  with httpx.stream('GET', 'http://localhost:8000/launch/sse/cycle',
                    headers={'Authorization': 'Bearer SECRET'}) as r:
      for line in r.iter_lines():
          print(line)

Events emitted:
  - governor_cycle: each completed Governor cycle
  - fleet_state: periodic fleet health snapshot
  - launch_score: each Launch Score calculation
  - escalation: when a veto or escalation occurs
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, Header, Request
from fastapi.responses import Response, StreamingResponse

from agentz.api.auth import SSE_COOKIE_NAME, sse_ticket_from_authorization, verify_sse_auth

router = APIRouter(prefix="/launch/sse", tags=["SSE"])

# ── Audit log paths ──────────────────────────────────────────────────────────

LOGS_DIR = Path(__file__).resolve().parents[1] / "logs"
GOVERNOR_LOG = LOGS_DIR / "governor_cycles.jsonl"
SCORE_LOG = LOGS_DIR / "launch_scores.jsonl"
ESCALATION_LOG = LOGS_DIR / "escalations.jsonl"


# ── SSE helpers ──────────────────────────────────────────────────────────────


def _sse_event(event: str, data: dict) -> str:
    """Format a single SSE event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _tail_jsonl(path: Path, poll_interval: float = 1.0) -> AsyncGenerator[str, None]:
    """
    Tail a JSONL file and yield SSE events for each new line.

    Starts from the end of the file, so clients only get new entries
    after they connect.
    """
    # Start from current end of file
    offset = 0
    if path.exists():
        offset = path.stat().st_size
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()

    while True:
        if path.exists():
            current_size = path.stat().st_size
            if current_size < offset:
                # File was truncated/rotated — start from beginning
                offset = 0
            if current_size > offset:
                with path.open("r", encoding="utf-8") as f:
                    f.seek(offset)
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            yield _sse_event("data", data)
                        except json.JSONDecodeError:
                            continue
                    offset = f.tell()
        await asyncio.sleep(poll_interval)


async def _periodic_snapshot(
    interval_s: float,
    max_count: int = 0,  # 0 = unlimited
) -> AsyncGenerator[str, None]:
    """
    Periodically emit a fleet state snapshot by running the Governor's
    assess_fleet method.
    """
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


def _verify_sse(request: Request) -> None:
    """Bearer or HttpOnly cookie. Query-string tokens are never accepted."""
    verify_sse_auth(
        authorization=request.headers.get("authorization"),
        cookie=request.cookies.get(SSE_COOKIE_NAME),
        query_token=request.query_params.get("token"),
    )


def _sse_cookie_secure(request: Request) -> bool:
    forwarded = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    return forwarded == "https" or request.url.scheme == "https"


# ── SSE Endpoints ────────────────────────────────────────────────────────────


@router.post("/session")
async def sse_session(request: Request, authorization: str | None = Header(None)):
    """Mint a short-lived HttpOnly cookie so EventSource can authenticate.

    The cookie holds an HMAC ticket, not the operator secret. Same-origin
    EventSource (or withCredentials) sends it automatically.
    """
    ticket = sse_ticket_from_authorization(authorization)
    response = Response(status_code=204)
    response.set_cookie(
        SSE_COOKIE_NAME,
        ticket,
        httponly=True,
        secure=_sse_cookie_secure(request),
        samesite="lax",
        path="/launch/sse",
        max_age=3600,
    )
    return response


@router.get("/cycle")
async def sse_governor_cycles(request: Request):
    """
    Stream Governor cycle events as they complete.

    Each event is a full GovernorCycle dict, emitted when a cycle finishes
    and is appended to governor_cycles.jsonl.

    Auth: Authorization Bearer or the HttpOnly cookie from POST /launch/sse/session.
    Query params:
      - poll: poll interval in seconds (default 1.0)
    """
    _verify_sse(request)
    poll = float(request.query_params.get("poll", "1.0"))

    async def stream():
        # Send a comment to keep the connection alive immediately
        yield ": connected\n\n"
        async for event in _tail_jsonl(GOVERNOR_LOG, poll_interval=poll):
            yield event

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable proxy buffering
        },
    )


@router.get("/score")
async def sse_launch_scores(request: Request):
    """
    Stream Launch Score events as they are calculated.

    Each event is a Launch Score dict, emitted when a score is appended
    to launch_scores.jsonl.
    """
    _verify_sse(request)
    poll = float(request.query_params.get("poll", "1.0"))

    async def stream():
        yield ": connected\n\n"
        async for event in _tail_jsonl(SCORE_LOG, poll_interval=poll):
            yield event

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/escalations")
async def sse_escalations(request: Request):
    """
    Stream escalation events (vetoes, risk escalations) in real-time.

    Each event is an escalation record from escalations.jsonl.
    """
    _verify_sse(request)
    poll = float(request.query_params.get("poll", "1.0"))

    async def stream():
        yield ": connected\n\n"
        async for event in _tail_jsonl(ESCALATION_LOG, poll_interval=poll):
            yield event

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/fleet")
async def sse_fleet_snapshots(request: Request):
    """
    Stream periodic fleet health snapshots.

    Runs assess_fleet() every N seconds and emits the summary.
    Useful for dashboards that want a live fleet health view.

    Auth: Authorization Bearer or the HttpOnly cookie from POST /launch/sse/session.
    Query params:
      - interval: seconds between snapshots (default 10)
      - count: max number of snapshots (0 = unlimited, default 0)
    """
    _verify_sse(request)
    interval = float(request.query_params.get("interval", "10"))
    count = int(request.query_params.get("count", "0"))

    async def stream():
        yield ": connected\n\n"
        async for event in _periodic_snapshot(interval_s=interval, max_count=count):
            yield event

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/all")
async def sse_all_events(request: Request):
    """
    Stream all event types: governor cycles, scores, escalations, and
    periodic fleet snapshots, multiplexed into a single stream.

    Each event has an 'event' field so clients can filter:
      es.addEventListener('governor_cycle', handler)
      es.addEventListener('launch_score', handler)
      es.addEventListener('escalation', handler)
      es.addEventListener('fleet_state', handler)

    Auth: Authorization Bearer or the HttpOnly cookie from POST /launch/sse/session.
    Query params:
      - poll: poll interval for log tailing (default 1.0)
      - fleet_interval: seconds between fleet snapshots (default 10)
    """
    _verify_sse(request)
    poll = float(request.query_params.get("poll", "1.0"))
    fleet_interval = float(request.query_params.get("fleet_interval", "10"))

    async def stream():
        yield ": connected\n\n"

        # Multiplex all sources
        queue: asyncio.Queue[str] = asyncio.Queue()

        async def producer(gen, event_name):
            try:
                async for data in gen:
                    # Parse and re-tag with the event name
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

        # Start all producers
        tasks = [
            asyncio.create_task(producer(_tail_jsonl(GOVERNOR_LOG, poll), "governor_cycle")),
            asyncio.create_task(producer(_tail_jsonl(SCORE_LOG, poll), "launch_score")),
            asyncio.create_task(producer(_tail_jsonl(ESCALATION_LOG, poll), "escalation")),
            asyncio.create_task(fleet_producer()),
        ]

        try:
            while True:
                event = await queue.get()
                yield event
        except asyncio.CancelledError:
            pass
        finally:
            for t in tasks:
                t.cancel()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ── Deployment control-plane endpoint ───────────────────────────────────────
# This router is already mounted by agentz.api.main, so the control plane is
# exposed without changing the main FastAPI bootstrap. Reads are fail-closed:
# missing provider credentials become explicit "unavailable" states.
@router.get("/control-plane/state", tags=["Control Plane"])
async def deployment_control_plane_state(request: Request):
    _verify_sse(request)
    from agentz.control_plane import collect_state
    return collect_state()
