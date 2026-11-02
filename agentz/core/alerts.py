"""Read-only anomaly triage for QR scan events, not counterfeit verdicts.

A scan burst may result from a popular code, a copied label, retry traffic,
or many other benign causes. No action here revokes a product, blocks a
person, makes a medical determination, or sends a third-party notification.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger("agentz.alerts")
WINDOW_MINUTES = 10
MIN_SCANS = 11
MIN_LOCATIONS = 2


def _timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return result.astimezone(timezone.utc) if result.tzinfo else None


def _location(scan: dict[str, Any]) -> tuple[str, str] | None:
    city, country = scan.get("city"), scan.get("country")
    if not isinstance(city, str) or not isinstance(country, str):
        return None
    city, country = city.strip().casefold(), country.strip().casefold()
    if not city or not country or len(city) > 100 or len(country) > 100:
        return None
    return city, country


def analyze_scan_events(
    scans: list[dict[str, Any]], *, now: datetime | None = None
) -> list[dict[str, Any]]:
    """Find time-bounded, deduplicated multi-location scan bursts.

    The common ``scan_events`` schema has id, qron_id, scanned_at, city,
    country. It does NOT prove the identifier uniquely binds one physical
    item; therefore even a valid burst can only request investigation.
    """
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must include timezone")
    now = now.astimezone(timezone.utc)
    grouped: dict[str, list[tuple[datetime, tuple[str, str]]]] = defaultdict(list)
    seen: set[str] = set()
    for scan in scans:
        if not isinstance(scan, dict):
            continue
        qid, event_id = scan.get("qron_id"), scan.get("id")
        if isinstance(qid, bool) or not isinstance(qid, (str, int)) or not str(qid).strip():
            continue
        if isinstance(event_id, bool) or not isinstance(event_id, (str, int)) or not str(event_id).strip():
            continue
        qid = str(qid).strip()
        if len(qid) > 96:
            continue
        observed, location = _timestamp(scan.get("scanned_at")), _location(scan)
        if observed is None or location is None:
            continue
        if not (now - timedelta(minutes=WINDOW_MINUTES) <= observed <= now):
            continue
        key = str(event_id)
        if key in seen:
            continue
        seen.add(key)
        grouped[qid].append((observed, location))

    alerts: list[dict[str, Any]] = []
    for qid, events in sorted(grouped.items()):
        distinct = len({location for _, location in events})
        if len(events) >= MIN_SCANS and distinct >= MIN_LOCATIONS:
            alerts.append({
                "type": "MULTI_LOCATION_SCAN_BURST",
                "qron_id": qid,
                "count": len(events),
                "distinct_locations": distinct,
                "window_minutes": WINDOW_MINUTES,
                "first_seen": min(ts for ts, _ in events).isoformat(),
                "last_seen": max(ts for ts, _ in events).isoformat(),
                "severity": "REVIEW",
                "verification": "not_performed",
                "counterfeit_verdict": None,
                "recommended_action": "investigate_provenance_and_source_data",
            })
    return alerts


async def detect_suspicious_activity(supabase, *, now: datetime | None = None) -> list[dict[str, Any]]:
    """Read recent scans; propagate DB errors rather than claim everything is safe."""
    result = (
        supabase.table("scan_events")
        .select("id,qron_id,scanned_at,city,country")
        .order("scanned_at", desc=True)
        .limit(200)
        .execute()
    )
    if getattr(result, "data", None) is None:
        raise RuntimeError("scan_events query unavailable; anomaly status unknown")
    return analyze_scan_events(result.data, now=now)


async def trigger_notifications(alerts: list[dict[str, Any]]) -> None:
    """Log review tickets locally only. No automatic sends or accusations."""
    for alert in alerts:
        if alert.get("type") != "MULTI_LOCATION_SCAN_BURST":
            continue
        logger.warning(
            "AgentZ investigation requested: %s events=%s; not a counterfeit verdict",
            alert.get("type"), alert.get("count"),
        )
