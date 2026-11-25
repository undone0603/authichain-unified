"""ai_adapt_archive_health — read-only health check for the AI Adapt archive.

From the AI Adapt archive v2 hardening plan (2026-10-14, Phase 2). The
archive bot pins papers and code it reports on, and the v2 functions in
supabase/migrations/20261014195307_* and 20261014195334_* track a per-item
watch streak and Software Heritage retries in `receipts`. This workflow reads
that state and the bot's own `ops_bot_log` rows and says whether the archive
is healthy.

Read-only: two PostgREST GETs (`ai_adapt_archive`, `ops_bot_log`). It never
writes, so it behaves the same in dry-run, confirm and auto.

Findings:
  red   archive bot has not logged a run for `silence_hours` (36h)
  red   the pg_cron heartbeat logged a `fail` row in the last 24h
  warn  an item is not `available`
  warn  an item's watch streak hit the alert (3) or dead-host (>= 7) mark
  warn  an item has not been checked for `stale_days` (8)
  warn  an item used all three Software Heritage retries

Status is red, unverified (the read failed), warn, or green. The run fails
on red or unverified so a scheduler sees it; warnings are reported only.

    python -m agentz.cli run ai_adapt_archive_health --mode dry-run
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from agentz.core.modes import ExecutionContext

ARCHIVE_BOT = "ai-adapt-archive"
HEARTBEAT_BOT = "ai-adapt-heartbeat"
SILENCE_HOURS = 36
HEARTBEAT_HOURS = 24
STALE_DAYS = 8
ALERT_STREAK = 3
DEAD_STREAK = 7
SWH_MAX_RETRIES = 3

ARCHIVE_SELECT = "item_key,availability,last_checked_at,receipts"
LOG_SELECT = "bot,run_at,status"


def _ts(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def evaluate(items: list[dict], log_rows: list[dict], now: datetime) -> dict:
    """Pure. Returns {status, findings, counts}."""
    findings: list[dict] = []

    archive_runs = [_ts(r.get("run_at")) for r in log_rows if r.get("bot") == ARCHIVE_BOT]
    archive_runs = [t for t in archive_runs if t]
    last_run = max(archive_runs) if archive_runs else None
    if last_run is None or now - last_run > timedelta(hours=SILENCE_HOURS):
        findings.append({
            "level": "red", "kind": "archive_silent", "item": ARCHIVE_BOT,
            "detail": (f"last run {last_run.isoformat()}" if last_run
                       else f"no run in the last {SILENCE_HOURS}h"),
        })

    beats = [
        _ts(r.get("run_at")) for r in log_rows
        if r.get("bot") == HEARTBEAT_BOT and r.get("status") == "fail"
    ]
    beats = [t for t in beats if t and now - t <= timedelta(hours=HEARTBEAT_HOURS)]
    if beats:
        findings.append({
            "level": "red", "kind": "heartbeat_fired", "item": HEARTBEAT_BOT,
            "detail": f"pg_cron heartbeat fired at {max(beats).isoformat()}",
        })

    counts = {"items": 0, "unavailable": 0, "alert": 0, "dead": 0, "stale": 0, "swh_exhausted": 0}
    for row in items:
        key = row.get("item_key")
        if not key:
            continue
        counts["items"] += 1
        receipts = row.get("receipts") if isinstance(row.get("receipts"), dict) else {}

        availability = row.get("availability")
        if availability != "available":
            counts["unavailable"] += 1
            findings.append({"level": "warn", "kind": "unavailable", "item": key,
                             "detail": f"availability={availability}"})

        watch = receipts.get("watch") if isinstance(receipts.get("watch"), dict) else {}
        streak = _int(watch.get("unchecked_streak"))
        if streak >= DEAD_STREAK:
            counts["dead"] += 1
            findings.append({"level": "warn", "kind": "dead_host", "item": key,
                             "detail": f"watch streak {streak} (>= {DEAD_STREAK}); Wayback re-queue stopped"})
        elif streak >= ALERT_STREAK:
            counts["alert"] += 1
            findings.append({"level": "warn", "kind": "watch_alert", "item": key,
                             "detail": f"watch streak {streak}"})

        checked = _ts(row.get("last_checked_at"))
        if checked is None or now - checked > timedelta(days=STALE_DAYS):
            counts["stale"] += 1
            findings.append({"level": "warn", "kind": "stale", "item": key,
                             "detail": (f"last checked {checked.isoformat()}" if checked
                                        else "never checked")})

        swh_retry = receipts.get("swh_retry") if isinstance(receipts.get("swh_retry"), dict) else {}
        if _int(swh_retry.get("count")) >= SWH_MAX_RETRIES:
            counts["swh_exhausted"] += 1
            findings.append({"level": "warn", "kind": "swh_retry_exhausted", "item": key,
                             "detail": f"{SWH_MAX_RETRIES} Software Heritage retries used"})

    levels = {f["level"] for f in findings}
    status = "red" if "red" in levels else "warn" if "warn" in levels else "green"
    findings.sort(key=lambda f: (f["level"] != "red", f["kind"], f["item"]))
    return {"status": status, "findings": findings, "counts": counts}


def _http_get(url: str, headers: dict, params: dict) -> list[dict]:
    import httpx

    r = httpx.get(url, headers=headers, params=params, timeout=15.0)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")
    return r.json()


def fetch(supabase_url: str, key: str, now: datetime,
          http_get: Callable[[str, dict, dict], list[dict]] = _http_get) -> tuple[list[dict], list[dict]]:
    """Read the archive rows and the recent fleet log. GET only."""
    base = supabase_url.rstrip("/") + "/rest/v1/"
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    items = http_get(base + "ai_adapt_archive", headers,
                     {"select": ARCHIVE_SELECT, "order": "item_key.asc", "limit": "5000"})
    since = (now - timedelta(hours=max(SILENCE_HOURS, HEARTBEAT_HOURS))).isoformat()
    logs = http_get(base + "ops_bot_log", headers, {
        "select": LOG_SELECT,
        "bot": f"in.({ARCHIVE_BOT},{HEARTBEAT_BOT})",
        "run_at": f"gte.{since}",
        "order": "run_at.desc",
        "limit": "1000",
    })
    return items, logs


def check(supabase_url: str | None, key: str | None, now: datetime | None = None,
          http_get: Callable[[str, dict, dict], list[dict]] = _http_get) -> dict:
    """Fail-closed wrapper: a read that cannot happen is `unverified`, never green.
    Error text is not carried into the result (it could hold a URL or key)."""
    now = now or datetime.now(UTC)
    if not supabase_url or not key:
        return {"status": "unverified", "findings": [], "counts": {},
                "detail": "Supabase URL or service key is missing"}
    try:
        items, logs = fetch(supabase_url, key, now, http_get)
    except Exception as exc:  # noqa: BLE001 - any failure means unverified
        msg = str(exc)
        detail = msg if msg.startswith("HTTP ") and len(msg) <= 8 else "read failed"
        return {"status": "unverified", "findings": [], "counts": {}, "detail": detail}
    return evaluate(items, logs, now)


def run(ctx: ExecutionContext) -> str:
    from agentz.core.credentials import get

    result = check(get("supabase_url", required=False),
                   get("supabase_service_key", required=False))
    result["checked_at"] = datetime.now(UTC).isoformat()
    if ctx.verbose:
        print(f"  [{ctx.workflow_id}] status={result['status']} counts={result.get('counts')}")
        for f in result["findings"][:25]:
            print(f"  [{ctx.workflow_id}] {f['level']:4} {f['kind']}: {f['item']} ({f['detail']})")
    ctx.save_state(result)
    if result["status"] in ("red", "unverified"):
        raise RuntimeError(f"ai_adapt archive health: {result['status']}")
    return f"ai_adapt archive health: {result['status']} ({result['counts'].get('items', 0)} items)"
