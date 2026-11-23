# AgentZ execution performance

All numbers below are **local, isolated benchmark results**. Nothing here was
measured against production, a third-party API, or a payment rail.

## Method

| Item | Value |
| --- | --- |
| Source | base `900156e1c26c8ea4e735cee29aa8fce3d4836bfc` plus this branch |
| Host | `LAPTOP-72MAGTL2`, WSL2, aarch64, 4 CPUs, 7.9 GB RAM, shared with the live AgentZ service and the CI runner |
| Python | 3.12.3 (`~/.agentz-venv`) |
| Tool server | `agentz/bench/mock_mcp_server.py` on 127.0.0.1, one uvicorn worker, 20 ms simulated I/O per `tools/call` |
| Workload | Round-robin over the 7 AVAILABLE read-only hosted capabilities with valid arguments |
| Counting | A success is one `tools/call` answered by the server. No caching, batching or coalescing. Duplicate idempotency keys are rejected and not counted |
| Pass rule | Success rate at least 99%, p99 at most 2,000 ms, achieved rate at least 95% of target. Automatic abort on error rate over 1%, p99 over the ceiling, or client RSS over 1,024 MB |
| Reproduce | `python -m agentz.bench.mcp_bench baseline --seconds 15` and `python -m agentz.bench.mcp_bench ramp --levels 100,500,1000,2000,4000 --seconds 30` |

## Results

| Metric | Baseline (sync client, sequential) | Async executor, 4,000/min for 120 s | Target |
| --- | --- | --- | --- |
| Successful calls/minute | 988.4 | 3,999.8 | 4,000 |
| Successful calls/second | 16.5 | 66.7 | 66.7 |
| Success rate | 100% | 100% | at least 99% |
| p50 / p95 / p99 latency | 54.2 / 90.2 / 185.8 ms | 24.5 / 38.3 / 62.4 ms | workload-dependent |
| Overhead over the 20 ms tool (p50) | about 34 ms | about 4.5 ms | minimized |
| Concurrency | 1 | pool of 64, queue limit 512 | tuned |
| Client CPU (share of one core) | 47.3% | 16.6% | sustainable |
| Client / server RSS | 54.3 MB / not measured | 55.5 / 30.4 MB | bounded |
| Model inference calls per tool call | 0 | 0 | 0 |
| Cost per 1,000 calls | local compute only | local compute only, no tokens, no paid API | minimized |

Ramp (30 s per level, concurrency 64): every level passed.

| Target/min | Achieved/min | Success | p99 ms | Client CPU |
| --- | --- | --- | --- | --- |
| 100 | 100.0 | 100% | 61.3 | 3.8% |
| 500 | 499.9 | 100% | 49.9 | 5.0% |
| 1,000 | 999.9 | 100% | 43.6 | 6.9% |
| 2,000 | 1,999.6 | 100% | 57.0 | 9.3% |
| 4,000 | 3,999.5 | 100% | 97.8 | 16.2% |

Fault injection, 4,000/min for 60 s with 0.5% of server responses failing with
HTTP 503: 29 retries, 0 failed calls, 100% success, p99 98.9 ms.

Headroom (concurrency 128): 8,000/min passed (p99 170 ms). 16,000/min failed the
latency rule (p95 1,984 ms, p99 2,526 ms; p50 still 24 ms) with client CPU at
49.5% of one core. The ceiling on this host is between 8,000 and 16,000 per
minute.

Evidence: `docs/agentz/evidence/perf-*.json`.

## What changed

| Bottleneck (measured) | Change |
| --- | --- |
| New TCP connection per call in `HostedMCPClient` | One pooled `httpx.AsyncClient` with keep-alive sized to the worker pool |
| JSON Schema compiled on every call | Validators compiled once per tool at discovery |
| Strictly sequential calls | Fixed pool of asyncio workers over a bounded priority queue with backpressure |
| No dependency handling | `run_plan` runs each step after its dependencies, independent steps in parallel, and skips dependents of failed steps |
| Timeout enforced only by the transport | Per-call `asyncio.wait_for` deadline (found by `test_timeouts_end_as_failures_not_hangs`) |

Unchanged on purpose: every call still passes the registry, capability-policy,
live read-only annotation, and schema gates; paid and blocked capabilities are
refused before any network call.

## Next bottleneck

Above about 8,000/min the client's single event loop is the limit: tail latency
climbs while p50 stays flat and client CPU nears half a core.

### 2026-11-23: JSON codec ruled out

The first candidate fix was a faster JSON codec. `AsyncCapabilityExecutor` now
decodes responses with orjson (`_loads` in `agentz/core/async_executor.py`).
The decoder gives the same value as `json.loads` and raises `ValueError` where
the stdlib does: any input with a 19-digit run goes to the stdlib, because
orjson silently turns integers outside [-2^63, 2^64) into floats. Anything
orjson rejects (NaN, BOM, lone surrogates) is re-decoded by the stdlib. Requests
still use httpx's stdlib encoder, because orjson would send NaN as `null` where
httpx refuses it.

Measured on an ephemeral 4-CPU cloud VM with Python 3.11.18. This is not the
host in the table above, so compare within this section only.

| Measure | Before | After |
| --- | --- | --- |
| Decode of a 682 B RPC envelope | 5.29 µs | 1.88 µs (2.8×) |
| Decode of 513 B of tool text | 4.13 µs | 2.25 µs (1.8×) |
| Client CPU at 12,000/min, concurrency 128 (two runs) | 30.0% / 29.2% | 27.7% / 27.2% |
| p99 at 12,000/min (two runs) | 27.4 / 26.8 ms | 26.1 / 26.6 ms |
| 24,000/min | aborted, p99 over 2,000 ms (both runs) | aborted, p99 over 2,000 ms (both runs) |

The end-to-end difference is about the size of run-to-run noise, and the
ceiling did not move. At roughly 1.5 ms of client CPU per call, JSON was never
the cost.

A cProfile at 12,000/min puts the time in the HTTP stack. httpcore's
`_assign_requests_to_connections` takes about 0.24 ms per request and calls
`is_idle` about 44 times per request, which is a linear scan of the 128-connection
pool. anyio and sniffio context wrappers come next. JSON decoding is not in the
top 25.

Evidence: `docs/agentz/evidence/perf-orjson-decode-2026-11-23.json`.

### Candidate fixes, re-ranked by the profile

1. Cut httpcore's per-request pool scan. Either shard calls over several smaller
   `AsyncClient` pools (for example 4 × 32 connections), or use a transport
   without the O(pool) assignment step (for example aiohttp, already pinned).
   Re-run the 12,000 and 24,000 levels as above.
2. One executor process per core.
3. Fewer per-call allocations. This is low value per the profile.
