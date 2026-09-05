"""
agentz.workflows.handlers.authichain_worker_outreach
---------------------------------------------------
Syncs HubSpot hot leads to the Cloudflare Outreach Engine and triggers a batch.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.hubspot import get_hot_leads, get_lead_contact_info
from agentz.core.outreach_engine import OutreachEngineClient
from agentz.core.llm import lm_manager

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
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
        skipped = 0

        # 2. Sync to D1
        for lead in leads:
            contact = ctx.step(
                f"Look up verified contact for {lead['name']}",
                action=lambda l=lead: asyncio.run(get_lead_contact_info(l["id"]))
            )

            contact_email = (contact or {}).get("email")
            if not contact_email:
                # Never invent an address for a real company -- skip instead.
                ctx.step(
                    f"Skip {lead['name']}: no verified contact email in HubSpot"
                )
                skipped += 1
                continue

            lead_payload = {
                "company": lead["name"],
                "contact_name": (contact or {}).get("name") or "Unknown",
                "contact_email": contact_email,
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

        return (
            f"Outreach complete. Synced {synced} leads to Cloudflare "
            f"({skipped} skipped: no verified contact). Result: {res}"
        )
    finally:
        lm_manager.unload_model("local-model")
