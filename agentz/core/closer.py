"""
agentz.core.closer
------------------
Closer Agent: Monitors HubSpot leads and autonomously closes revenue.
Coordinates DocuSign and Stripe for immediate pilot conversion.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from agentz.core.credentials import get
from agentz.core.docusign import create_envelope_from_markdown
from agentz.workflows.handlers.docusign_blitz import _extract_recipient
from agentz.workflows.handlers.qron_stripe import create_stripe_payment_link

logger = logging.getLogger("agentz.closer")

async def check_demo_viewed(deal_id: str) -> bool:
    """
    Checks if a lead has viewed their personalized microsite.
    No real signal source exists yet (would require a 'microsite_analytics'
    table in Supabase) -- fails closed: returns False so no deal is ever
    autonomously closed based on a signal that was never actually observed.
    """
    return False

async def send_closing_package(supabase, deal_data: Dict[str, Any], agreement_path: str):
    """
    Autonomously sends the DocuSign agreement and Stripe payment link.

    `agreement_path` must point at a real, pre-authored agreement file with
    an explicit `recipient: someone@example.com` line in its frontmatter --
    the same convention docusign_blitz.py uses. No filename-guessing based
    on the deal's name, and no fallback to a generic default agreement:
    a deal without a matching, addressed agreement is skipped rather than
    sent to a guessed recipient.
    """
    deal_name = deal_data.get("name", "Strategic Lead")
    deal_id = deal_data.get("id", "0")

    email = _extract_recipient(agreement_path)
    if not email:
        logger.warning(f"No `recipient:` in {agreement_path} frontmatter -- skipping closing package for {deal_name}")
        return {"deal_id": deal_id, "package_sent": False, "reason": "agreement has no recipient"}

    # 1. Generate Stripe Checkout Link ($2,500 Setup)
    stripe_res = await create_stripe_payment_link(2500)
    payment_url = stripe_res.get("url")

    # 2. Dispatch DocuSign Agreement
    ds_res = await create_envelope_from_markdown(agreement_path, email)

    # 3. Log to HubSpot & Queue Outreach
    logger.info(f"Closing package dispatched for {deal_name}. Payment: {payment_url} | Envelope: {ds_res.get('envelope_id')}")

    return {
        "deal_id": deal_id,
        "payment_url": payment_url,
        "envelope_id": ds_res.get("envelope_id"),
        "package_sent": True
    }

async def run_closing_loop(supabase, agreement_path: Optional[str] = None):
    """
    The main autonomous closer loop. Requires an explicit `agreement_path`
    (no per-deal guessing) -- without one, does nothing rather than
    guessing which agreement to send.
    """
    if not agreement_path:
        logger.info("run_closing_loop: no agreement_path provided -- nothing to close.")
        return []

    # 1. Fetch Hot Deals
    from agentz.core.hubspot import get_all_deals
    leads = await get_all_deals(limit=5)

    closings = []
    for lead in leads:
        if await check_demo_viewed(lead["id"]):
            res = await send_closing_package(supabase, lead, agreement_path)
            closings.append(res)

    return closings
