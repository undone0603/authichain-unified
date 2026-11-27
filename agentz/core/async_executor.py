"""Concurrent, deterministic executor for approved AgentZ MCP capabilities.

Claude plans; this executes. A validated plan of capability calls runs on a
fixed pool of asyncio workers over one pooled HTTP client, with no model
inference per call. Every call passes the same gates as
`agentz.integrations.authichain_mcp.HostedMCPClient.call`:

1. registry entry exists, is AVAILABLE, agentz_executable, read-only;
2. `capability_policy.decide` allows its policy capability;
3. the live tool is annotated readOnlyHint=true, destructiveHint=false;
4. arguments validate against the live input schema (validators compiled once).

Throughput comes from concurrency and connection reuse, never from skipping a
gate. A duplicate idempotency key is rejected, not merged, so every counted
success is one independent execution.
"""
from __future__ import annotations

import asyncio
import itertools
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from agentz.core.capability_policy import decide
from agentz.integrations.authichain_mcp import CapabilityError, Registry

TRANSIENT_STATUS = frozenset({429, 500, 502, 503, 504})

try:  # orjson is pinned in requirements-agentz.txt; stdlib json stays the fallback.
    import orjson as _orjson
except ImportError:  # pragma: no cover
    _orjson = None


# orjson decodes integers outside [-2**63, 2**64) as floats, silently losing precision
# (think atomic USDC or wei amounts). Every such literal has at least 19 digits, so any
# input with a 19-digit run goes to the stdlib; digits inside strings only cost speed.
# The scan is translate + substring search, both in C (a regex here cost as much as
# the stdlib parse it was meant to avoid).
_DIGIT_MASK = bytes(0x30 if 0x30 <= c <= 0x39 else 0x20 for c in range(256))
_LONG_RUN = b"0" * 19


def _loads(data: bytes | str) -> Any:
    """Decode JSON to the same value `json.loads` gives, raising ValueError where it does.

    orjson is the fast path. It is stricter than the stdlib (NaN/Infinity literals,
    non-UTF-8 bytes, a BOM, lone surrogates), so anything it rejects is re-decoded by
    `json.loads`, which decides; inputs where it would be lossy never reach it.
    """
    if _orjson is not None:
        try:
            raw = data.encode() if isinstance(data, str) else data
        except UnicodeEncodeError:  # lone surrogates: only the stdlib accepts them
            raw = None
        if raw is not None and _LONG_RUN not in raw.translate(_DIGIT_MASK):
            try:
                return _orjson.loads(raw)
            except ValueError:
                pass
    return json.loads(data)


@dataclass(order=True)
class _Job:
    priority: int
    seq: int
    call: "ToolCall" = field(compare=False)
    future: asyncio.Future = field(compare=False)
    enqueued: float = field(compare=False, default=0.0)


@dataclass
class ToolCall:
    capability_id: str
    arguments: dict[str, Any] = field(default_factory=dict)
    priority: int = 5  # lower runs first
    idempotency_key: str | None = None


@dataclass
class CallResult:
    trace_id: str
    capability_id: str
    ok: bool
    result: Any = None
    error: str | None = None
    attempts: int = 0
    queue_ms: float = 0.0
    exec_ms: float = 0.0


@dataclass
class ExecutorStats:
    submitted: int = 0
    succeeded: int = 0
    failed: int = 0
    retries: int = 0
    refused: int = 0
    duplicates_rejected: int = 0
    max_queue_depth: int = 0


class AsyncCapabilityExecutor:
    def __init__(self, registry: Registry, *, concurrency: int = 64, queue_limit: int = 4096,
                 timeout_s: float = 10.0, max_attempts: int = 3, backoff_s: float = 0.05,
                 transport: Any = None):
        import httpx

        self.registry = registry
        self.concurrency = concurrency
        self.timeout_s = timeout_s
        self.max_attempts = max_attempts
        self.backoff_s = backoff_s
        limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=concurrency)
        self._http = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_s), limits=limits, transport=transport,
            headers={"accept": "application/json, text/event-stream",
                     "user-agent": "agentz-async-executor/1"})
        self._queue: asyncio.PriorityQueue[_Job] = asyncio.PriorityQueue(maxsize=queue_limit)
        self._seq = itertools.count()
        self._workers: list[asyncio.Task] = []
        self._tools: dict[str, dict[str, Any]] = {}
        self._validators: dict[str, Any] = {}
        self._inflight_keys: set[str] = set()
        self._done_keys: set[str] = set()
        self.stats = ExecutorStats()

    # ---- lifecycle ------------------------------------------------------------------
    async def start(self) -> None:
        await self._discover()
        self._workers = [asyncio.create_task(self._worker()) for _ in range(self.concurrency)]

    async def close(self) -> None:
        for w in self._workers:
            w.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncCapabilityExecutor":
        await self.start()
        return self

    async def __aexit__(self, *_exc) -> None:
        await self.close()

    # ---- gates ----------------------------------------------------------------------
    async def _discover(self) -> None:
        import jsonschema

        body = await self._rpc("tools/list", {})
        self._tools = {t["name"]: t for t in body.get("tools") or [] if "name" in t}
        for name, tool in self._tools.items():
            schema = tool.get("inputSchema") or {"type": "object"}
            cls = jsonschema.validators.validator_for(schema)
            self._validators[name] = cls(schema)

    def _authorize(self, call: ToolCall) -> str:
        cap = self.registry.capabilities.get(call.capability_id)
        if cap is None:
            raise CapabilityError("unknown_capability", call.capability_id)
        if cap["entrypoint"].get("adapter") != "mcp":
            raise CapabilityError("wrong_adapter", call.capability_id)
        if not cap["agentz_executable"] or cap["status"] != "AVAILABLE":
            raise CapabilityError("not_executable", cap.get("blocker") or cap["status"])
        decision = decide(cap["policy_capability"])
        if not decision.allowed:
            raise CapabilityError("policy_refused", decision.reason)
        tool_name = cap["entrypoint"]["tool"]
        tool = self._tools.get(tool_name)
        if tool is None:
            raise CapabilityError("not_live", tool_name)
        ann = tool.get("annotations") or {}
        if ann.get("readOnlyHint") is not True or ann.get("destructiveHint") is not False:
            raise CapabilityError("live_not_read_only", tool_name)
        errors = list(self._validators[tool_name].iter_errors(call.arguments))
        if errors:
            raise CapabilityError("invalid_arguments", errors[0].message[:300])
        return tool_name

    # ---- transport ------------------------------------------------------------------
    async def _rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        payload = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": method, "params": params}
        # Requests stay on httpx's stdlib encoder: orjson would silently turn NaN into
        # null where httpx refuses it (allow_nan=False). Only decoding is accelerated.
        resp = await self._http.post(self.registry.endpoint, json=payload)
        if resp.status_code in TRANSIENT_STATUS:
            raise _Transient(f"http {resp.status_code}")
        if resp.status_code != 200:
            raise CapabilityError("upstream_rejected", f"http {resp.status_code}")
        body = _loads(resp.content)
        if "error" in body:
            raise CapabilityError("rpc_error", str(body["error"])[:300])
        return body.get("result") or {}

    # ---- execution ------------------------------------------------------------------
    async def submit(self, call: ToolCall) -> CallResult:
        """Queue one call. Applies backpressure when the queue is full."""
        self.stats.submitted += 1
        key = call.idempotency_key
        if key is not None:
            if key in self._inflight_keys or key in self._done_keys:
                self.stats.duplicates_rejected += 1
                return CallResult(trace_id=str(uuid.uuid4()), capability_id=call.capability_id,
                                  ok=False, error="duplicate_idempotency_key")
            self._inflight_keys.add(key)
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        await self._queue.put(_Job(call.priority, next(self._seq), call, fut, time.monotonic()))
        self.stats.max_queue_depth = max(self.stats.max_queue_depth, self._queue.qsize())
        return await fut

    async def _worker(self) -> None:
        while True:
            job = await self._queue.get()
            try:
                result = await self._execute(job)
                if not job.future.done():
                    job.future.set_result(result)
            finally:
                key = job.call.idempotency_key
                if key is not None:
                    self._inflight_keys.discard(key)
                    self._done_keys.add(key)
                self._queue.task_done()

    async def _execute(self, job: _Job) -> CallResult:
        call = job.call
        started = time.monotonic()
        res = CallResult(trace_id=str(uuid.uuid4()), capability_id=call.capability_id, ok=False,
                         queue_ms=(started - job.enqueued) * 1000)
        try:
            tool_name = self._authorize(call)
        except CapabilityError as exc:
            self.stats.refused += 1
            res.error = exc.code
            return res
        for attempt in range(1, self.max_attempts + 1):
            res.attempts = attempt
            try:
                # Enforce the deadline here, not only in the HTTP transport.
                out = await asyncio.wait_for(
                    self._rpc("tools/call", {"name": tool_name, "arguments": call.arguments}),
                    self.timeout_s)
                res.ok = not out.get("isError", False)
                res.result = _content(out)
                if not res.ok:
                    res.error = "tool_error"
                break
            except _Transient as exc:
                res.error = f"upstream_unavailable: {exc}"
            except asyncio.TimeoutError:
                res.error = "timeout"
            except CapabilityError as exc:
                res.error = exc.code
                break
            except Exception as exc:  # network errors; read-only, so retrying is safe
                res.error = f"transport_error: {type(exc).__name__}"
            if attempt < self.max_attempts:
                self.stats.retries += 1
                await asyncio.sleep(self.backoff_s * 2 ** (attempt - 1))
        res.exec_ms = (time.monotonic() - started) * 1000
        if res.ok:
            self.stats.succeeded += 1
        else:
            self.stats.failed += 1
        return res

    async def run_plan(self, plan: dict[str, tuple[ToolCall, list[str]]]) -> dict[str, CallResult]:
        """Run named calls; each waits only for the names it depends on.

        A step whose dependency failed is not run and reports dependency_failed.
        """
        _check_acyclic(plan)
        done: dict[str, asyncio.Future] = {
            n: asyncio.get_running_loop().create_future() for n in plan}

        async def run_one(name: str) -> None:
            call, deps = plan[name]
            dep_results = [await done[d] for d in deps]
            if any(not r.ok for r in dep_results):
                done[name].set_result(CallResult(trace_id=str(uuid.uuid4()),
                                                 capability_id=call.capability_id, ok=False,
                                                 error="dependency_failed"))
                return
            done[name].set_result(await self.submit(call))

        await asyncio.gather(*(run_one(n) for n in plan))
        return {n: f.result() for n, f in done.items()}


class _Transient(Exception):
    pass


def _check_acyclic(plan: dict[str, tuple[ToolCall, list[str]]]) -> None:
    state: dict[str, int] = {}

    def visit(n: str) -> None:
        if n not in plan:
            raise CapabilityError("invalid_plan", f"unknown dependency {n}")
        if state.get(n) == 1:
            raise CapabilityError("invalid_plan", f"cycle at {n}")
        if state.get(n) == 2:
            return
        state[n] = 1
        for d in plan[n][1]:
            visit(d)
        state[n] = 2

    for name in plan:
        visit(name)


def _content(result: dict[str, Any]) -> Any:
    parts = result.get("content") or []
    texts = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("type") == "text"]
    if len(texts) == 1:
        try:
            return _loads(texts[0])
        except ValueError:
            return texts[0]
    return parts
