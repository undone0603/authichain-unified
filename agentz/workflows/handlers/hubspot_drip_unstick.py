"""
agentz.workflows.handlers.hubspot_drip_unstick
----------------------------------------------
Resets HubSpot contacts stuck at hs_lead_status='IN_PROGRESS'.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext

HUBSPOT_BASE = "https://api.hubapi.com"


def run(ctx: ExecutionContext) -> str:
    token = get_or_placeholder("hubspot_token", ctx)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Load checkpoint
    state = ctx.load_state()
    finished_ids = set(state.get("finished_ids", []))

    # 1) Find stuck contacts
    stuck = ctx.step(
        f"query HubSpot contacts where hs_lead_status='IN_PROGRESS'",
        action=lambda: _search_stuck(headers),
    ) or []

    if not stuck:
        ctx.clear_state()
        return "no stuck contacts found"

    # Filter out already finished
    to_process = [c for c in stuck if c["id"] not in finished_ids]
    if not to_process:
        ctx.clear_state()
        return f"all {len(stuck)} contacts already processed in previous run"

    ctx.step(f"found {len(stuck)} total stuck; {len(to_process)} remaining to process")

    # 2) Reset each
    reset_count = 0
    for contact in to_process:
        cid   = contact["id"]
        email = contact.get("properties", {}).get("email", "?")
        ok = ctx.step(
            f"reset contact {cid} ({email}) hs_lead_status → OPEN",
            action=lambda c=cid: _reset_contact(headers, c),
        )
        if ok:
            reset_count += 1
            finished_ids.add(cid)
            # Save checkpoint after each successful step
            ctx.save_state({"finished_ids": list(finished_ids)})

    ctx.clear_state() # Cleanup after full success
    return f"reset {reset_count}/{len(to_process)} contacts"


def _search_stuck(headers: dict) -> list[dict]:
    body = {
        "filterGroups": [{
            "filters": [
                {"propertyName": "hs_lead_status", "operator": "EQ", "value": "IN_PROGRESS"}
            ]
        }],
        "properties": ["email", "firstname", "lastname", "hs_lead_status"],
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
        "hs_lead_status": "OPEN",
    }}
    r = httpx.patch(
        f"{HUBSPOT_BASE}/crm/v3/objects/contacts/{contact_id}",
        headers=headers, json=body, timeout=30.0,
    )
    return r.status_code in (200, 204)
