"""
agentz.core.reputation
----------------------
Handles reputation tracking and updates for Protocol Agents based on
verification claims and consensus results.
"""
from __future__ import annotations
import logging
from typing import Dict, Any

logger = logging.getLogger("agentz.reputation")

async def update_agent_reputation(supabase, agent_id: int, claim_id: int) -> float:
    """
    Updates an agent's reputation score based on a verification claim outcome.
    """
    try:
        # 1. Fetch claim and agent
        claim_res = supabase.table("verification_claims").select("*").eq("id", claim_id).single().execute()
        claim = claim_res.data
        if not claim: return 0.0

        agent_res = supabase.table("protocol_agents").select("reputation_score").eq("id", agent_id).single().execute()
        agent = agent_res.data
        if not agent: return 0.0

        current_score = float(agent.get("reputation_score", 0))
        confidence = float(claim.get("confidence", 0))
        status = claim.get("status")

        # 2. Reputation Adjustment Logic
        if status == "success":
            # Reward: Increase score based on confidence
            adjustment = confidence / 10.0
            new_score = current_score + adjustment
        else:
            # Penalty: Decrease score based on lack of confidence
            adjustment = (100.0 - confidence) / 5.0
            new_score = max(0.0, current_score - adjustment)

        # 3. Update Agent
        supabase.table("protocol_agents").update({
            "reputation_score": new_score
        }).eq("id", agent_id).execute()

        logger.info(f"Agent {agent_id} reputation updated: {current_score} -> {new_score} (claim {claim_id})")
        
        return float(new_score)
        
    except Exception as e:
        logger.error(f"Failed to update reputation for agent {agent_id}: {e}")
        return 0.0
