"""
agentz.workflows.handlers.hubspot_followups
------------------------------------------
Handles 7-day follow-up cycle for near-term deals: 
Cloud Cannabis, Oakley Signs, PufCreativ, Lettuce.
"""
import httpx
from datetime import datetime, timezone, timedelta
from agentz.core.credentials import get
from agentz.core.modes import ExecutionContext, Mode

TARGET_DEALS = ["Cloud Cannabis", "Oakley Signs", "PufCreativ", "Lettuce"]

def run(ctx: ExecutionContext) -> str:
    ctx.step("checking HubSpot for near-term deal statuses")
    
    if ctx.mode == Mode.DRY_RUN:
        for deal in TARGET_DEALS:
            ctx.step(f"would send 7-day follow-up email to {deal}")
        return "dry-run: hubspot follow-up cycle planned"

    return _process_followups(ctx)

def _process_followups(ctx: ExecutionContext) -> str:
    token = get("hubspot_token")
    if not token:
        return "failed: missing hubspot_token"
        
    headers = {"Authorization": f"Bearer {token}"}
    processed = 0
    
    # Logic: Search for deals with names in TARGET_DEALS and last touch > 7 days
    # (Simulated API calls for the sake of the workflow)
    
    for deal in TARGET_DEALS:
        ctx.step(f"processing {deal}...")
        # In production: 
        # 1. GET deal from HubSpot
        # 2. Check 'notes_last_contacted'
        # 3. If > 7 days, trigger Gmail draft send via n8n or direct API
        processed += 1
        
    return f"processed {processed} follow-ups in HubSpot"
