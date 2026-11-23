"""AsyncCapabilityExecutor correctness. In-process mock transport; no network."""
import asyncio
import dataclasses
import json
import time

import httpx
import pytest

from agentz.core.async_executor import AsyncCapabilityExecutor, ToolCall
from agentz.integrations import authichain_mcp as m

RO = {"readOnlyHint": True, "destructiveHint": False}
TOOLS = [
    {"name": "get_pricing", "annotations": RO, "inputSchema": {"type": "object"}},
    {"name": "query_provenance", "annotations": RO,
     "inputSchema": {"type": "object", "required": ["assetId"],
                     "properties": {"assetId": {"type": "string"}}}},
    {"name": "dpp_readiness_check", "annotations": {"readOnlyHint": False, "destructiveHint": True},
     "inputSchema": {"type": "object"}},
]


class Server:
    def __init__(self, delay=0.0, fail_first=0, status=503):
        self.delay, self.fail_first, self.status = delay, fail_first, status
        self.calls, self.inflight, self.max_inflight = [], 0, 0

    async def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if body["method"] == "tools/list":
            return httpx.Response(200, json={"result": {"tools": TOOLS}})
        self.inflight += 1
        self.max_inflight = max(self.max_inflight, self.inflight)
        try:
            await asyncio.sleep(self.delay)
            self.calls.append((time.monotonic(), body["params"]))
            if self.fail_first > 0:
                self.fail_first -= 1
                return httpx.Response(self.status)
            return httpx.Response(200, json={"result": {"content": [
                {"type": "text", "text": json.dumps({"tool": body["params"]["name"]})}]}})
        finally:
            self.inflight -= 1


def executor(server, **kw):
    reg = dataclasses.replace(m.load_registry(), endpoint="http://mock/mcp")
    return AsyncCapabilityExecutor(reg, transport=httpx.MockTransport(server.handler),
                                   backoff_s=0.0, **kw)


def run(coro):
    return asyncio.run(coro)


def test_success_carries_unique_trace_ids():
    async def go():
        s = Server()
        async with executor(s, concurrency=4) as ex:
            rs = await asyncio.gather(*(ex.submit(ToolCall("authichain.mcp.get_pricing"))
                                        for _ in range(10)))
        return rs, ex.stats
    rs, stats = run(go())
    assert all(r.ok for r in rs)
    assert len({r.trace_id for r in rs}) == 10
    assert stats.succeeded == 10 and stats.failed == 0


def test_runs_calls_concurrently_up_to_the_pool_size():
    async def go():
        s = Server(delay=0.05)
        async with executor(s, concurrency=8) as ex:
            t0 = time.monotonic()
            await asyncio.gather(*(ex.submit(ToolCall("authichain.mcp.get_pricing")) for _ in range(16)))
            return time.monotonic() - t0, s.max_inflight
    elapsed, peak = run(go())
    assert peak == 8
    assert elapsed < 0.05 * 16 / 2  # far below sequential time


@pytest.mark.parametrize("call,code", [
    (ToolCall("authichain.mcp.verify"), "not_executable"),            # paid, BLOCKED
    (ToolCall("does.not.exist"), "unknown_capability"),
    (ToolCall("agentz.control_plane.state"), "wrong_adapter"),
    (ToolCall("authichain.mcp.query_provenance", {}), "invalid_arguments"),
    (ToolCall("authichain.mcp.dpp_readiness_check", {"category": "x"}), "live_not_read_only"),
    (ToolCall("authichain.mcp.scan_living_qr", {"object_id": "x"}), "not_live"),
])
def test_every_gate_refuses_before_the_network(call, code):
    async def go():
        s = Server()
        async with executor(s) as ex:
            r = await ex.submit(call)
        return r, s.calls, ex.stats
    r, calls, stats = run(go())
    assert r.ok is False and r.error == code
    assert calls == [] and stats.refused == 1


def test_transient_failures_retry_and_are_counted():
    async def go():
        s = Server(fail_first=2)
        async with executor(s, max_attempts=3) as ex:
            r = await ex.submit(ToolCall("authichain.mcp.get_pricing"))
        return r, ex.stats
    r, stats = run(go())
    assert r.ok and r.attempts == 3 and stats.retries == 2


def test_client_errors_are_not_retried():
    async def go():
        s = Server(fail_first=5, status=403)
        async with executor(s, max_attempts=3) as ex:
            r = await ex.submit(ToolCall("authichain.mcp.get_pricing"))
        return r, len(s.calls)
    r, n = run(go())
    assert r.ok is False and r.error == "upstream_rejected" and n == 1


def test_timeouts_end_as_failures_not_hangs():
    async def go():
        s = Server(delay=0.5)
        async with executor(s, timeout_s=0.05, max_attempts=2) as ex:
            return await ex.submit(ToolCall("authichain.mcp.get_pricing"))
    r = run(go())
    assert r.ok is False and r.attempts == 2


def test_duplicate_idempotency_key_is_rejected_not_counted():
    async def go():
        s = Server(delay=0.02)
        async with executor(s) as ex:
            a, b = await asyncio.gather(
                ex.submit(ToolCall("authichain.mcp.get_pricing", idempotency_key="k1")),
                ex.submit(ToolCall("authichain.mcp.get_pricing", idempotency_key="k1")))
            c = await ex.submit(ToolCall("authichain.mcp.get_pricing", idempotency_key="k1"))
        return [a, b, c], len(s.calls), ex.stats
    rs, n, stats = run(go())
    assert n == 1 and stats.succeeded == 1 and stats.duplicates_rejected == 2
    assert sorted(r.error or "" for r in rs) == ["", "duplicate_idempotency_key", "duplicate_idempotency_key"]


def test_plan_respects_dependencies_and_runs_independent_steps_in_parallel():
    async def go():
        s = Server(delay=0.05)
        async with executor(s, concurrency=8) as ex:
            plan = {
                "price": (ToolCall("authichain.mcp.get_pricing"), []),
                "prov_a": (ToolCall("authichain.mcp.query_provenance", {"assetId": "a"}), []),
                "prov_b": (ToolCall("authichain.mcp.query_provenance", {"assetId": "b"}), ["prov_a"]),
            }
            t0 = time.monotonic()
            out = await ex.run_plan(plan)
            return out, time.monotonic() - t0, s.calls
    out, elapsed, calls = run(go())
    assert all(r.ok for r in out.values())
    order = [p["arguments"].get("assetId") for _, p in calls]
    assert order.index("a") < order.index("b")
    assert elapsed < 0.05 * 3  # price ran alongside prov_a


def test_failed_dependency_skips_dependents():
    async def go():
        s = Server()
        async with executor(s) as ex:
            return await ex.run_plan({
                "bad": (ToolCall("authichain.mcp.query_provenance", {}), []),
                "after": (ToolCall("authichain.mcp.get_pricing"), ["bad"]),
            }), s.calls
    out, calls = run(go())
    assert out["bad"].error == "invalid_arguments"
    assert out["after"].error == "dependency_failed" and calls == []


def test_cyclic_or_unknown_plans_are_refused():
    async def go(plan):
        async with executor(Server()) as ex:
            await ex.run_plan(plan)
    with pytest.raises(m.CapabilityError):
        run(go({"a": (ToolCall("authichain.mcp.get_pricing"), ["b"]),
                "b": (ToolCall("authichain.mcp.get_pricing"), ["a"])}))
    with pytest.raises(m.CapabilityError):
        run(go({"a": (ToolCall("authichain.mcp.get_pricing"), ["missing"])}))


def test_bounded_queue_applies_backpressure():
    async def go():
        s = Server(delay=0.05)
        async with executor(s, concurrency=2, queue_limit=4) as ex:
            await asyncio.gather(*(ex.submit(ToolCall("authichain.mcp.get_pricing")) for _ in range(20)))
        return ex.stats
    stats = run(go())
    assert stats.max_queue_depth <= 4 and stats.succeeded == 20
