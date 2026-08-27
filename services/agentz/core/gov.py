"""
agentz.core.gov
---------------
Gov Agent: Manages municipal transparency, project logs, and grant verification.
"""
from __future__ import annotations
import uuid
from typing import Dict, Any

from agentz.core.blockchain import BlockchainAgent

async def register_public_project(supabase, project_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a municipal project or infrastructure record in GovChain.
    Includes on-chain trust anchoring for transparency.
    """
    project_id = str(uuid.uuid4())
    
    # On-chain Anchoring
    blockchain = BlockchainAgent()
    tx_hash = await blockchain.anchor_identity({
        "id": project_id,
        "municipality": project_data.get("municipality"),
        "budget": project_data.get("budget")
    })
    
    payload = {
        "id": project_id,
        "name": project_data["name"],
        "brand": project_data.get("municipality", "City of Detroit"),
        "industry_id": "government",
        "blockchain_hash": tx_hash,
        "metadata": {
            "type": project_data.get("type", "infrastructure"),
            "status": project_data.get("status", "active"),
            "budget": project_data.get("budget"),
            "tx_hash": tx_hash,
            "transparency_url": f"https://govchain.us/projects/{project_id}"
        }
    }
    
    # Real Supabase Insert
    response = supabase.table("products").insert(payload).execute()
    
    return {
        "project": payload,
        "supabase_response": response.data
    }

async def verify_grant_proposal(proposal_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simulates verification of a grant proposal for GovChain.
    """
    return {
        "verified": True,
        "confidence": 98.5,
        "timestamp": "ISO8601-NOW"
    }
