"""
agentz.core.closer
------------------
Closer Agent: Monitors HubSpot leads and autonomously closes revenue.
Coordinates DocuSign and Stripe for immediate pilot conversion.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List
from agentz.core.credentials import get
from agentz.core.docusign import create_envelope_from_markdown
from agentz.workflows.handlers.qron_stripe import create_stripe_payment_link

logger = logging.getLogger("agentz.closer")

async def check_demo_viewed(deal_id: str) -> bool:
    """
    Checks if a lead has viewed their personalized microsite.
    In production, this would query a 'microsite_analytics' table in Supabase.
    """
    # For simulation, we'll return True for high-priority deals
    return True

async def send_closing_package(supabase, deal_data: Dict[str, Any]):
    """
    Autonomously sends the DocuSign agreement and Stripe payment link.
    """
    deal_name = deal_data.get("name", "Strategic Lead")
    deal_id = deal_data.get("id", "0")
    email = deal_data.get("email", "admin@authichain.com")
    
    # 1. Generate Stripe Checkout Link ($2,500 Setup)
    stripe_res = await create_stripe_payment_link(2500)
    payment_url = stripe_res.get("url")
    
    # 2. Dispatch DocuSign Agreement
    # Locate best-fit agreement draft
    from pathlib import Path
    agreements = list(Path("agentz/logs/agreements").glob(f"*{deal_name.lower().split()[0]}*.md"))
    agreement_path = str(agreements[0]) if agreements else "agentz/logs/agreements/default_partnership.md"
    
    ds_res = await create_envelope_from_markdown(agreement_path, email)
    
    # 3. Log to HubSpot & Queue Outreach
    logger.info(f"Closing package dispatched for {deal_name}. Payment: {payment_url} | Envelope: {ds_res.get('envelope_id')}")
    
    return {
        "deal_id": deal_id,
        "payment_url": payment_url,
        "envelope_id": ds_res.get("envelope_id"),
        "package_sent": True
    }

async def run_closing_loop(supabase):
    """
    The main autonomous closer loop.
    """
    # 1. Fetch Hot Deals
    from agentz.core.hubspot import get_all_deals
    leads = await get_all_deals(limit=5)
    
    closings = []
    for lead in leads:
        if await check_demo_viewed(lead["id"]):
            res = await send_closing_package(supabase, lead)
            closings.append(res)
            
    return closings
