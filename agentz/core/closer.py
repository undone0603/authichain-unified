"""
agentz.core.closer
------------------
Closer Agent: Production-only revenue closure.
"""
from agentz.workflows.handlers.qron_stripe import create_stripe_payment_link
from agentz.core.docusign import create_envelope_from_markdown
import logging

logger = logging.getLogger("agentz.closer")

async def send_closing_package(supabase, lead_data: dict) -> dict:
    deal_name = lead_data.get("name")
    email = lead_data.get("email")
    deal_id = lead_data.get("id")

    # 1. Generate REAL Stripe Checkout Link ($2,500 Setup)
    # This will now fail hard if STRIPE_SECRET_KEY is missing, enforcing production compliance.
    stripe_res = await create_stripe_payment_link(2500)
    payment_url = stripe_res.get("url")
    
    # 2. Dispatch DocuSign Agreement
    ds_res = await create_envelope_from_markdown("agentz/logs/agreements/partner_mou.md", email)
    
    logger.info(f"Closing package dispatched for {deal_name}. Payment: {payment_url} | Envelope: {ds_res.get('envelope_id')}")
    
    return {
        "deal_id": deal_id,
        "payment_url": payment_url,
        "envelope_id": ds_res.get("envelope_id"),
        "package_sent": True
    }
