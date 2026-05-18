"""
agentz.workflows.handlers.authichain_worker_outreach
---------------------------------------------------
Syncs HubSpot hot leads to the Cloudflare Outreach Engine and triggers a batch.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.hubspot import get_hot_leads
from agentz.core.outreach_engine import OutreachEngineClient

def run(ctx: ExecutionContext) -> str:
    ctx.step("--- AUTONOMOUS CLOUDFLARE OUTREACH ---")
    
    # 1. Fetch leads from HubSpot
    leads = ctx.step(
        "Fetch hot leads for worker sync",
        action=lambda: asyncio.run(get_hot_leads(limit=5))
    )
    
    if not leads:
        return "No hot leads to sync."

    client = OutreachEngineClient()
    synced = 0

    # 2. Sync to D1
    for lead in leads:
        lead_payload = {
            "company": lead["name"],
            "contact_name": "Procurement Team", # Placeholder
            "contact_email": f"contact@{lead['slug']}.com", # Simulated
            "industry": lead.get("vertical", "luxury"),
            "priority": 10
        }
        
        success = ctx.step(
            f"Sync {lead['name']} to Cloudflare D1",
            action=lambda l=lead_payload: asyncio.run(client.add_lead(l))
        )
        if success: synced += 1

    # 3. Trigger Batch
    res = ctx.step(
        "Trigger Cloudflare Worker outreach batch",
        action=lambda: asyncio.run(client.trigger_batch())
    )
    
    return f"Outreach complete. Synced {synced} leads to Cloudflare. Result: {res}"
