"""
agentz.core.campaigns
---------------------
Campaign Agent: Manages, optimizes, and scales merchant reward campaigns.
"""
from __future__ import annotations
import uuid
from typing import List, Dict, Any
from agentz.core.growth import issue_qron

async def generate_campaign_rules(vertical: str) -> Dict[str, Any]:
    """Generates optimized reward rules based on the business vertical."""
    if vertical == "dispensary":
        return {
            "base_reward": 15,
            "repeat_multiplier": 1.5,
            "milestones": {"5_scans": 50, "10_scans": 150}
        }
    elif vertical == "brewery":
        return {
            "base_reward": 10,
            "happy_hour_bonus": 5,
            "referral_reward": 25
        }
    return {"base_reward": 10}

async def create_campaign(supabase, business_id: str, vertical: str) -> Dict[str, Any]:
    """
    Creates a new reward campaign for a business in Supabase.
    """
    campaign_id = str(uuid.uuid4())
    rules = await generate_campaign_rules(vertical)
    
    payload = {
        "id": campaign_id,
        "business_id": business_id,
        "campaign_type": "engagement_loyalty",
        "reward_amount": rules.get("base_reward", 10),
        "active": True,
        "rules": rules
    }
    
    # Real Supabase Insert
    response = supabase.table("email_campaigns").insert(payload).execute()
    
    return {
        "campaign": payload,
        "supabase_response": response.data
    }

async def optimize_campaigns(supabase):
    """
    Analyzes scan velocity and engagement to adjust campaign rewards.
    """
    # 1. Fetch active campaigns
    campaigns = supabase.table("email_campaigns").select("*").eq("active", True).execute().data
    
    optimizations = []
    for camp in campaigns:
        # 2. Fetch recent scan counts for this campaign's business
        # This is simplified for the demo
        scans = supabase.table("scan_events").select("count", count="exact").eq("business_id", camp["business_id"]).execute().count
        
        if scans and scans < 5:
            # Low engagement: Boost rewards
            new_amount = camp["reward_amount"] * 1.2
            supabase.table("email_campaigns").update({"reward_amount": new_amount}).eq("id", camp["id"]).execute()
            optimizations.append(f"Boosted {camp['id']} to {new_amount} (Low engagement)")
            
    return optimizations
