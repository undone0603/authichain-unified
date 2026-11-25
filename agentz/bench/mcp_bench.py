"""AgentZ tool-execution benchmark against the loopback mock MCP server.

Never targets production, third parties, or payment rails: the registry copy it
uses points at http://127.0.0.1:<port>/mcp served by agentz.bench.mock_mcp_server.

    python -m agentz.bench.mcp_bench baseline --seconds 15
    python -m agentz.bench.mcp_bench ramp --levels 100,500,1000,2000,4000 --seconds 30

A level passes only when success rate >= 99%, p99 <= the latency ceiling, and
achieved successes/minute >= 95% of the target. A level that fails stops the ramp.
Cache hits and duplicates are never counted: every success is one tools/call
answered by the server.
"""
from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import os
import socket
import statistics
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import psutil

from agentz.core.async_executor import AsyncCapabilityExecutor, ToolCall
from agentz.integrations.authichain_mcp import HostedMCPClient, load_registry

WORKLOAD = [
    ("authichain.mcp.get_pricing", {}),
    ("authichain.mcp.query_provenance", {"assetId": "bench-asset"}),
    ("authichain.mcp.verify_attestation", {"assetId": "bench-asset"}),
    ("authichain.mcp.verify_record", {"id": "bench-record"}),
    ("authichain.mcp.dpp_readiness_check", {"category": "textiles", "sells_in_eu": True}),
    ("authichain.mcp.scan_living_qr", {"object_id": "qron:url:deadbeef"}),
    ("authichain.mcp.negotiate", {"service": "verify"}),
]


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(latency_ms: float, fail_rate: float) -> tuple[subprocess.Popen, str]:
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "agentz.bench.mock_mcp_server", "--port", str(port),
         "--latency-ms", str(latency_ms), "--fail-rate", str(fail_rate)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return proc, f"http://127.0.0.1:{port}/mcp"
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("mock server did not start")


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    return s[min(len(s) - 1, int(round(p / 100 * (len(s) - 1))))]


def run_baseline(endpoint: str, seconds: float) -> dict[str, Any]:
    reg = dataclasses.replace(load_registry(), endpoint=endpoint)
    client = HostedMCPClient(reg)
    lat: list[float] = []
    ok = fail = 0
    proc = psutil.Process()
    cpu0 = proc.cpu_times()
    t0 = time.monotonic()
    i = 0
    while time.monotonic() - t0 < seconds:
        cid, args = WORKLOAD[i % len(WORKLOAD)]
        i += 1
        s = time.monotonic()
        try:
            out = client.call(cid, args)
            ok += 1 if out["ok"] else 0
            fail += 0 if out["ok"] else 1
        except Exception:
            fail += 1
        lat.append((time.monotonic() - s) * 1000)
    wall = time.monotonic() - t0
    cpu1 = proc.cpu_times()
    return {
        "mode": "baseline_sync_sequential", "seconds": round(wall, 2), "succeeded": ok,
        "failed": fail, "success_per_min": round(ok / wall * 60, 1),
        "p50_ms": round(pct(lat, 50), 2), "p95_ms": round(pct(lat, 95), 2),
        "p99_ms": round(pct(lat, 99), 2),
        "client_cpu_pct": round(((cpu1.user + cpu1.system) - (cpu0.user + cpu0.system)) / wall * 100, 1),
        "client_rss_mb": round(proc.memory_info().rss / 2**20, 1),
    }


async def run_level(endpoint: str, target_per_min: int, seconds: float, concurrency: int,
                    p99_ceiling_ms: float, rss_cap_mb: float, server_pid: int) -> dict[str, Any]:
    reg = dataclasses.replace(load_registry(), endpoint=endpoint)
    proc, server = psutil.Process(), psutil.Process(server_pid)
    lat: list[float] = []
    queue_waits: list[float] = []
    results = []
    abort_reason = None
    async with AsyncCapabilityExecutor(reg, concurrency=concurrency, queue_limit=concurrency * 8) as ex:
        interval = 60.0 / target_per_min
        cpu0, scpu0 = proc.cpu_times(), server.cpu_times()
        t0 = time.monotonic()
        tasks: list[asyncio.Task] = []
        i = 0

        async def one(call: ToolCall) -> None:
            s = time.monotonic()
            r = await ex.submit(call)
            lat.append((time.monotonic() - s) * 1000)
            queue_waits.append(r.queue_ms)
            results.append(r)

        while (now := time.monotonic()) - t0 < seconds:
            due = int((now - t0) / interval) + 1
            while i < due:
                cid, args = WORKLOAD[i % len(WORKLOAD)]
                tasks.append(asyncio.create_task(one(ToolCall(cid, dict(args)))))
                i += 1
            if len(results) >= 200 and len(results) % 200 < 50:
                fails = sum(1 for r in results if not r.ok)
                if fails / len(results) > 0.01:
                    abort_reason = f"error rate {fails / len(results):.2%}"
                    break
                if pct(lat[-500:], 99) > p99_ceiling_ms:
                    abort_reason = f"p99 {pct(lat[-500:], 99):.0f} ms over ceiling"
                    break
                if proc.memory_info().rss / 2**20 > rss_cap_mb:
                    abort_reason = "client memory over cap"
                    break
            await asyncio.sleep(min(interval, 0.005))
        submit_wall = time.monotonic() - t0
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30)
        wall = time.monotonic() - t0
        cpu1, scpu1 = proc.cpu_times(), server.cpu_times()
        stats = dataclasses.asdict(ex.stats)

    ok = sum(1 for r in results if r.ok)
    total = len(results)
    achieved = ok / submit_wall * 60 if submit_wall else 0.0
    success_rate = ok / total if total else 0.0
    p99 = pct(lat, 99)
    passed = (abort_reason is None and success_rate >= 0.99 and p99 <= p99_ceiling_ms
              and achieved >= 0.95 * target_per_min)
    return {
        "target_per_min": target_per_min, "seconds": round(submit_wall, 2),
        "submitted": i, "completed": total, "succeeded": ok, "failed": total - ok,
        "success_rate": round(success_rate, 4), "success_per_min": round(achieved, 1),
        "success_per_sec": round(achieved / 60, 2),
        "p50_ms": round(pct(lat, 50), 2), "p95_ms": round(pct(lat, 95), 2), "p99_ms": round(p99, 2),
        "mean_exec_ms": round(statistics.fmean(r.exec_ms for r in results), 2) if results else 0,
        "p95_queue_ms": round(pct(queue_waits, 95), 2),
        "concurrency": concurrency, "executor": stats,
        "client_cpu_pct": round(((cpu1.user + cpu1.system) - (cpu0.user + cpu0.system)) / wall * 100, 1),
        "server_cpu_pct": round(((scpu1.user + scpu1.system) - (scpu0.user + scpu0.system)) / wall * 100, 1),
        "client_rss_mb": round(proc.memory_info().rss / 2**20, 1),
        "server_rss_mb": round(server.memory_info().rss / 2**20, 1),
        "abort_reason": abort_reason, "passed": passed,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["baseline", "ramp"])
    ap.add_argument("--seconds", type=float, default=30)
    ap.add_argument("--levels", default="100,500,1000,2000,4000")
    ap.add_argument("--concurrency", type=int, default=64)
    ap.add_argument("--latency-ms", type=float, default=20.0)
    ap.add_argument("--fail-rate", type=float, default=0.0)
    ap.add_argument("--p99-ceiling-ms", type=float, default=2000)
    ap.add_argument("--rss-cap-mb", type=float, default=1024)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    server, endpoint = start_server(a.latency_ms, a.fail_rate)
    report: dict[str, Any] = {
        "environment": {"host": socket.gethostname(), "cpus": os.cpu_count(),
                        "python": sys.version.split()[0], "mock_latency_ms": a.latency_ms,
                        "mock_fail_rate": a.fail_rate, "workload": [c for c, _ in WORKLOAD]},
        "results": []}
    try:
        if a.mode == "baseline":
            report["results"].append(run_baseline(endpoint, a.seconds))
        else:
            for level in [int(x) for x in a.levels.split(",")]:
                r = asyncio.run(run_level(endpoint, level, a.seconds, a.concurrency,
                                          a.p99_ceiling_ms, a.rss_cap_mb, server.pid))
                report["results"].append(r)
                print(json.dumps({k: r[k] for k in ("target_per_min", "success_per_min", "success_rate",
                                                    "p99_ms", "passed", "abort_reason")}), flush=True)
                if not r["passed"]:
                    break
    finally:
        server.terminate()
        server.wait(timeout=10)
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(report, indent=2))
    print(json.dumps(report["results"][-1] if report["results"] else {}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
