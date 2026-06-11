"""
agentz.workflows.handlers.hubspot_drip_unstick
----------------------------------------------
Resets HubSpot contacts stuck at drip_status='active' for >7 days.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext

HUBSPOT_BASE = "https://api.hubapi.com"


def run(ctx: ExecutionContext) -> str:
    token = get_or_placeholder("hubspot_token", ctx)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # 1) Find stuck contacts
    stuck = ctx.step(
        f"query HubSpot contacts where drip_status='active' AND last_drip_sent < {cutoff}",
        action=lambda: _search_stuck(headers, cutoff),
    ) or []

    if not stuck:
        return "no stuck contacts found"

    ctx.step(f"found {len(stuck)} stuck contacts")

    # 2) Reset each
    reset_count = 0
    for contact in stuck:
        cid   = contact["id"]
        email = contact.get("properties", {}).get("email", "?")
        ok = ctx.step(
            f"reset contact {cid} ({email}) drip_status → queued",
            action=lambda c=cid: _reset_contact(headers, c),
        )
        if ok:
            reset_count += 1

    return f"reset {reset_count}/{len(stuck)} contacts"


def _search_stuck(headers: dict, cutoff_iso: str) -> list[dict]:
    body = {
        "filterGroups": [{
            "filters": [
                {"propertyName": "drip_status",    "operator": "EQ", "value": "active"},
                {"propertyName": "last_drip_sent", "operator": "LT", "value": cutoff_iso},
            ]
        }],
        "properties": ["email", "firstname", "lastname", "drip_status", "last_drip_sent"],
        "limit": 100,
    }
    r = httpx.post(
        f"{HUBSPOT_BASE}/crm/v3/objects/contacts/search",
        headers=headers, json=body, timeout=30.0,
    )
    r.raise_for_status()
    return r.json().get("results", [])


def _reset_contact(headers: dict, contact_id: str) -> bool:
    body = {"properties": {
        "drip_status":    "queued",
        "drip_reset_at":  datetime.now(timezone.utc).isoformat(),
        "drip_reset_by":  "agentz-runner",
    }}
    r = httpx.patch(
        f"{HUBSPOT_BASE}/crm/v3/objects/contacts/{contact_id}",
        headers=headers, json=body, timeout=30.0,
    )
    return r.status_code in (200, 204)
