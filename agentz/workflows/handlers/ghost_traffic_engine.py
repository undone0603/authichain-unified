"""
agentz.workflows.handlers.ghost_traffic_engine
----------------------------------------------
Light health probes for the four estate apexes plus money/loop mounts.

No paid APIs. No invented secrets. Safe GET / empty-JSON POST only.
Unexpected 5xx (or transport failure) fails the run.
"""
from __future__ import annotations

import datetime
import json
import urllib.error
import urllib.request

from agentz.core.modes import ExecutionContext, Mode

USER_AGENT = "authichain-ghost-traffic/1.1"
PROBE_TIMEOUT_S = 12

# Four estate apexes (landing HTML). app.* is a product host, not an estate apex.
ESTATE_APEXES = (
    "https://authichain.com/",
    "https://strainchain.io/",
    "https://govchain.us/",
    "https://qron.space/",
)

# Safe API probes on the protocol apex. POST /api/funnel with {} is 400
# (validation) and must not insert a row.
API_PROBES: tuple[tuple[str, str], ...] = (
    ("GET", "https://authichain.com/api/x402/health"),
    ("POST", "https://authichain.com/api/funnel"),
)


class UnexpectedServerError(RuntimeError):
    """Raised when a probe returns 5xx or cannot complete."""


def _probe(method: str, url: str, timeout: float = PROBE_TIMEOUT_S) -> int:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    data = None
    if method == "POST":
        headers["Content-Type"] = "application/json"
        data = b"{}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return int(resp.status)
    except urllib.error.HTTPError as exc:
        return int(exc.code)


def run(ctx: ExecutionContext) -> str:
    ctx.step("Ghost Traffic Engine initializing")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    ctx.step(f"Run timestamp: {now}")

    plan = [f"GET {url}" for url in ESTATE_APEXES]
    plan.extend(f"{method} {url}" for method, url in API_PROBES)

    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"[DRY-RUN] Would probe {len(plan)} targets (no HTTP):")
        for line in plan:
            ctx.step(f"  -> {line}")
        return "dry-run: ghost traffic plan rendered — no requests sent"

    results: list[tuple[str, str, int]] = []
    failures: list[str] = []

    for url in ESTATE_APEXES:
        try:
            status = _probe("GET", url)
        except Exception as exc:  # noqa: BLE001 — transport failure is a failed probe
            failures.append(f"GET {url} transport: {exc}")
            ctx.step(f"GET {url} -> TRANSPORT_ERROR {exc}")
            continue
        results.append(("GET", url, status))
        ctx.step(f"GET {url} -> {status}")
        if status >= 500:
            failures.append(f"GET {url} -> {status}")

    for method, url in API_PROBES:
        try:
            status = _probe(method, url)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{method} {url} transport: {exc}")
            ctx.step(f"{method} {url} -> TRANSPORT_ERROR {exc}")
            continue
        results.append((method, url, status))
        ctx.step(f"{method} {url} -> {status}")
        if status >= 500:
            failures.append(f"{method} {url} -> {status}")

    summary = {
        "probes": [
            {"method": method, "url": url, "status": status}
            for method, url, status in results
        ],
        "failures": failures,
        "at": now,
    }
    ctx.step(json.dumps(summary, sort_keys=True))

    if failures:
        raise UnexpectedServerError(
            "ghost-traffic unexpected 5xx or transport failure: "
            + "; ".join(failures)
        )

    return (
        f"Ghost Traffic Engine probed {len(results)} targets at {now}. "
        "No unexpected 5xx."
    )
