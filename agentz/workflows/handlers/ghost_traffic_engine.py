"""
agentz.workflows.handlers.ghost_traffic_engine
----------------------------------------------
Light health probes for the four estate apexes plus money/loop mounts.

No paid APIs. No invented secrets. Safe GET / empty-JSON POST only.
Unexpected 5xx (or transport failure) fails the run.
GET /api/checkout/dpp must 302/303 — do not follow the Stripe redirect.
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

# Public money paths. Checkout is redirect-only: 302/303 = OK, 200 HTML fails.
MONEY_PATHS = (
    "https://authichain.com/pricing",
    "https://authichain.com/dpp",
    "https://authichain.com/x402",
    "https://authichain.com/onboard",
    "https://authichain.com/api/checkout/dpp",
    "https://strainchain.io/pricing",
    "https://strainchain.io/onboard",
    "https://qron.space/pricing",
    "https://qron.space/generate",
    "https://govchain.us/onboard",
)

CHECKOUT_DPP_URL = "https://authichain.com/api/checkout/dpp"
CHECKOUT_OK_STATUSES = frozenset({302, 303})


class UnexpectedServerError(RuntimeError):
    """Raised when a probe returns 5xx, a bad checkout status, or cannot complete."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Surface the redirect status instead of following (no Stripe GET)."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)


_OPENER = urllib.request.build_opener(_NoRedirect)


def _probe(method: str, url: str, timeout: float = PROBE_TIMEOUT_S) -> int:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    data = None
    if method == "POST":
        headers["Content-Type"] = "application/json"
        data = b"{}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with _OPENER.open(req, timeout=timeout) as resp:
            return int(resp.status)
    except urllib.error.HTTPError as exc:
        return int(exc.code)


def _status_is_failure(url: str, status: int) -> bool:
    if url == CHECKOUT_DPP_URL:
        return status not in CHECKOUT_OK_STATUSES
    return status >= 500


def _all_probes() -> list[tuple[str, str]]:
    probes: list[tuple[str, str]] = [("GET", url) for url in ESTATE_APEXES]
    probes.extend(API_PROBES)
    probes.extend(("GET", url) for url in MONEY_PATHS)
    return probes


def run(ctx: ExecutionContext) -> str:
    ctx.step("Ghost Traffic Engine initializing")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    ctx.step(f"Run timestamp: {now}")

    probes = _all_probes()
    plan = [f"{method} {url}" for method, url in probes]

    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"[DRY-RUN] Would probe {len(plan)} targets (no HTTP):")
        for line in plan:
            ctx.step(f"  -> {line}")
        return "dry-run: ghost traffic plan rendered — no requests sent"

    results: list[tuple[str, str, int]] = []
    failures: list[str] = []

    for method, url in probes:
        try:
            status = _probe(method, url)
        except Exception as exc:  # noqa: BLE001 — transport failure is a failed probe
            failures.append(f"{method} {url} transport: {exc}")
            ctx.step(f"{method} {url} -> TRANSPORT_ERROR {exc}")
            continue
        results.append((method, url, status))
        ctx.step(f"{method} {url} -> {status}")
        if _status_is_failure(url, status):
            detail = f"{method} {url} -> {status}"
            if url == CHECKOUT_DPP_URL:
                detail += " (expected 302 or 303)"
            failures.append(detail)

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
