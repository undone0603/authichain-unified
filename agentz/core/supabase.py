"""
agentz.core.supabase
--------------------
Supabase Client for AgentZ: Handles lead synchronization and protocol logging.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, Optional
from supabase import create_client, Client
from agentz.core.credentials import get

logger = logging.getLogger("agentz.supabase")

_client: Optional[Client] = None

def get_supabase() -> Optional[Client]:
    global _client
    if _client: return _client
    
    url = get("next_public_supabase_url")
    key = get("supabase_service_role_key")
    
    if not url or not key:
        logger.warning("Supabase credentials missing.")
        return None
        
    try:
        _client = create_client(url, key)
        return _client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

async def upsert_lead(lead_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Synchronizes a HubSpot lead into the Supabase 'lead_captures' table."""
    sb = get_supabase()
    if not sb: return None
    
    email = lead_data.get("email")
    if not email: return None
    
    # Generate slug if not present
    name = lead_data.get("name", "brand")
    slug = lead_data.get("slug")
    if not slug:
        slug = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
        while "--" in slug: slug = slug.replace("--", "-")
    
    payload = {
        "email": email,
        "name": lead_data.get("name"),
        "source": lead_data.get("source", "agentz_outreach"),
        "metadata": {**lead_data.get("metadata", {}), "slug": slug, "company": lead_data.get("company"), "industry": lead_data.get("industry")},
        "status": lead_data.get("status", "new")
    }
    
    try:
        # Check if exists
        res = sb.table("lead_captures").select("id").eq("email", email).execute()
        if res.data:
            lead_id = res.data[0]["id"]
            sb.table("lead_captures").update(payload).eq("id", lead_id).execute()
            payload["id"] = lead_id
        else:
            res = sb.table("lead_captures").insert(payload).execute()
            if res.data:
                payload["id"] = res.data[0]["id"]
        
        return payload
    except Exception as e:
        logger.error(f"Supabase upsert_lead failed: {e}")
        return None
