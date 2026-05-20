"""
agentz.core.redemption
----------------------
Redemption Agent: Manages QRON token burning and merchant discount issuance.
Implements the "Layer 2 Siphon" revenue model.
"""
from __future__ import annotations
import uuid
import logging
from typing import Dict, Any, List

logger = logging.getLogger("agentz.redemption")

async def burn_qron_for_discount(supabase, wallet: str, amount: float, business_id: str) -> Dict[str, Any]:
    """
    Executes a QRON burn event. The user spends QRON to receive a discount.
    """
    redemption_id = str(uuid.uuid4())
    discount_value = amount / 10.0 # Example: 10 QRON = $1.00 Discount
    siphon_fee = 0.05 # Layer 2 Siphon: $0.05 per redemption
    
    # 1. Record Burn Event in Supabase
    burn_payload = {
        "id": redemption_id,
        "wallet": wallet,
        "business_id": business_id,
        "qron_amount": amount,
        "discount_value": discount_value,
        "siphon_fee": siphon_fee,
        "status": "pending_verification"
    }
    
    try:
        supabase.table("redemptions").insert(burn_payload).execute()
        logger.info(f"Burn event recorded: {redemption_id}")
    except Exception as e:
        logger.error(f"Failed to record burn event: {e}")
        # Continue even if logging fails for the demo
    
    # 2. Generate Merchant Redemption Code
    redemption_code = f"QRON-{redemption_id[:8].upper()}"
    
    return {
        "redemption_id": redemption_id,
        "code": redemption_code,
        "discount": f"${discount_value:.2f}",
        "siphon_billed": siphon_fee,
        "status": "Ready for Merchant Scan"
    }

async def verify_merchant_redemption(supabase, redemption_id: str):
    """
    Called by the merchant when the discount code is scanned at checkout.
    Updates the siphon billing log.
    """
    try:
        supabase.table("redemptions").update({
            "status": "verified", 
            "redeemed_at": "now()" # Postgrest now()
        }).eq("id", redemption_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to verify redemption: {e}")
        return False
