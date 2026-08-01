"""
agentz.core.growth
------------------
Growth Agent: Campaign optimization and reward balancing.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("agentz.growth")

async def get_user_scan_count(supabase, user_id: int) -> int:
    """
    Fetches total scan count for a given user identifier from Supabase.
    """
    try:
        response = await supabase.table("scan_events") \
            .select("id", count="exact") \
            .eq("user_id", user_id) \
            .execute()
        return response.count or 0
    except Exception as e:
        logger.error(f"Failed to fetch scan count: {e}")
        return 0

async def issue_qron(wallet: str, amount: float) -> Optional[str]:
    """
    No real QRON token contract exists in this codebase (unlike
    agentz.core.blockchain's real Web3 anchoring/bounty-claim calls, which
    have a live contract address and ABI) -- there is nothing to actually
    issue. Returns None rather than a hash formatted to look like a real
    Polygon transaction: this function previously fabricated one via
    sha256(wallet+amount+timestamp), which is indistinguishable at a glance
    from `agentz.core.blockchain.BlockchainAgent`'s genuine tx hashes. That
    self-generated, unverifiable "proof" was returned directly to callers
    of the live `POST /scan` API (agentz/api/main.py) as `reward.tx_hash`,
    i.e. real callers of that endpoint would receive a fabricated
    blockchain confirmation for a token that was never actually
    transferred. See reward_repeat_scans below for how callers should
    treat the absence of a hash.
    """
    return None

async def check_for_chapter_unlock_nudge(supabase, user_id: int, product_id: str):
    """
    Checks if a user is nearing a chapter unlock and sends a proactive nudge.
    """
    scans = await get_user_scan_count(supabase, user_id)
    
    if scans >= 4:
        msg = f"🏆 [Growth Nudge] User {user_id} is nearing unlock for Chapter 2 for product {product_id}!"
        print(f"  [growth] {msg}")
        return True
    return False

async def reward_repeat_scans(supabase, wallet: str, product_id: Optional[str] = None, event_type: str = "scan") -> Dict[str, Any]:
    """
    Determines and issues rewards based on user engagement and event type.
    """
    # Base scan reward
    reward = 10.0
    
    # Community Verification Bonus
    if event_type == "community_verification":
        reward = 20.0
        
    tx_hash = await issue_qron(wallet, reward)
    
    # Proactive Gamification Nudge
    if product_id and event_type == "scan":
        # Placeholder: Resolve user_id from wallet
        user_id = 0 
        await check_for_chapter_unlock_nudge(supabase, user_id, product_id)
    
    return {
        "wallet": wallet,
        "reward_amount": reward,
        "event": event_type,
        "token": "QRON",
        "tx_hash": tx_hash,
        # No on-chain issuance is implemented yet -- tx_hash is always None
        # (see issue_qron). Callers (the /scan API response, dashboards,
        # UI) must check this before presenting reward_amount/tx_hash as a
        # confirmed on-chain transfer.
        "status": "pending_onchain_issuance",
        "gateway": "https://qron.space/rewards"
    }
