"""AsyncCapabilityExecutor correctness. In-process mock transport; no network."""
import asyncio
import dataclasses
import json
import math
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


# ---- JSON codec: orjson for speed, stdlib json as the referee --------------------------
from agentz.core import async_executor as ax

CODEC_VALID = [
    b'{"a": 1, "b": [true, false, null], "c": "x"}',
    '{"unicode": "é中\U0001F600"}',
    b'{"big": 123456789012345678901234567890}',  # beyond 64 bits: orjson rejects, stdlib decodes
    b'{"nan": NaN, "inf": Infinity, "ninf": -Infinity}',  # stdlib extension orjson refuses
    b'\xef\xbb\xbf{"bom": true}',  # UTF-8 BOM bytes
    '{"dup": 1, "dup": 2}',
    b'[1.5, -0.0, 1e300]',
    '"just a string"',
    b"18446744073709551615",  # 2**64 - 1: largest int orjson keeps exact
    b"18446744073709551616",  # 2**64: orjson would return a float
    b"-9223372036854775809",  # -2**63 - 1: orjson would return a float
    b'{"usdc_atomic": 1000000000000000000000001}',
    b"123456789012345678.5",
    '{"s": "\\ud800"}',  # escaped lone surrogate
    '"\ud800"',  # raw lone surrogate in a str: cannot be UTF-8 encoded
]


def _same_typed(a, b):
    # 1 == 1.0 in Python, so compare types too: a lossy int->float must fail.
    return type(a) is type(b) and json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
CODEC_INVALID = [b"", b"not json", b'{"a": }', "{'single': 1}", b"\xff\xfe\x00"]


def _same(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_same(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b))
    if isinstance(a, float) and isinstance(b, float) and math.isnan(a):
        return math.isnan(b)
    return _same_typed(a, b)


@pytest.mark.parametrize("data", CODEC_VALID)
def test_codec_decodes_exactly_like_stdlib(data):
    assert _same(ax._loads(data), json.loads(data))


@pytest.mark.parametrize("data", CODEC_INVALID)
def test_codec_raises_value_error_where_stdlib_does(data):
    with pytest.raises(ValueError):
        json.loads(data)
    with pytest.raises(ValueError):
        ax._loads(data)


@pytest.mark.parametrize("data", CODEC_VALID)
def test_codec_falls_back_without_orjson(monkeypatch, data):
    monkeypatch.setattr(ax, "_orjson", None)
    assert _same(ax._loads(data), json.loads(data))


def test_codec_matches_stdlib_on_random_documents():
    import random
    rng = random.Random(20261123)

    def value(depth):
        kind = rng.randrange(7 if depth < 4 else 4)
        if kind == 0:
            return rng.randint(-2**70, 2**70)
        if kind == 1:
            return rng.uniform(-1e12, 1e12)
        if kind == 2:
            return "".join(chr(rng.randrange(0x20, 0x3000)) for _ in range(rng.randrange(8)))
        if kind == 3:
            return rng.choice([True, False, None])
        if kind in (4, 5):
            return [value(depth + 1) for _ in range(rng.randrange(4))]
        return {str(rng.random()): value(depth + 1) for _ in range(rng.randrange(4))}

    for _ in range(500):
        text = json.dumps(value(0), ensure_ascii=rng.random() < 0.5)
        assert _same(ax._loads(text), json.loads(text)), text
        assert _same(ax._loads(text.encode()), json.loads(text.encode())), text


def test_orjson_is_active_when_installed():
    pytest.importorskip("orjson")
    assert ax._orjson is not None


def _text_server(text: str):
    async def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["method"] == "tools/list":
            return httpx.Response(200, json={"result": {"tools": TOOLS}})
        return httpx.Response(200, json={"result": {"content": [{"type": "text", "text": text}]}})
    return handler


@pytest.mark.parametrize("text, expected", [
    ('{"score": 0.97, "id": "a"}', {"score": 0.97, "id": "a"}),
    ('{"n": 123456789012345678901234567890}', {"n": 123456789012345678901234567890}),
    ("plain text, not JSON", "plain text, not JSON"),
])
def test_tool_text_content_decodes_like_before(text, expected):
    async def go():
        reg = dataclasses.replace(m.load_registry(), endpoint="http://mock/mcp")
        async with AsyncCapabilityExecutor(reg, transport=httpx.MockTransport(_text_server(text)),
                                           backoff_s=0.0) as ex:
            return await ex.submit(ToolCall("authichain.mcp.get_pricing"))
    res = run(go())
    assert res.ok and res.result == expected


def test_non_json_response_body_is_a_transport_error_and_retried():
    hits = {"call": 0}

    async def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["method"] == "tools/list":
            return httpx.Response(200, json={"result": {"tools": TOOLS}})
        hits["call"] += 1
        return httpx.Response(200, content=b"<html>gateway</html>")

    async def go():
        reg = dataclasses.replace(m.load_registry(), endpoint="http://mock/mcp")
        async with AsyncCapabilityExecutor(reg, transport=httpx.MockTransport(handler),
                                           backoff_s=0.0, max_attempts=2) as ex:
            return await ex.submit(ToolCall("authichain.mcp.get_pricing"))
    res = run(go())
    assert not res.ok and res.error == "transport_error: JSONDecodeError"
    assert res.attempts == 2 and hits["call"] == 2


def test_requests_still_refuse_nan_arguments():
    """orjson would encode NaN as null; requests stay on httpx's allow_nan=False encoder."""
    sent = []

    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if body["method"] == "tools/list":
            return httpx.Response(200, json={"result": {"tools": TOOLS}})
        sent.append(body)
        return httpx.Response(200, json={"result": {"content": []}})

    async def go():
        reg = dataclasses.replace(m.load_registry(), endpoint="http://mock/mcp")
        async with AsyncCapabilityExecutor(reg, transport=httpx.MockTransport(handler),
                                           backoff_s=0.0, max_attempts=1) as ex:
            return await ex.submit(ToolCall("authichain.mcp.get_pricing", {"x": float("nan")}))
    res = run(go())
    assert not res.ok and res.error.startswith("transport_error") and sent == []
