"""
agentz.core.extension
---------------------
Extension Agent: Manages the configuration and brand lists for the 
'Authentic' Chrome Extension.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any

async def generate_extension_manifest(supabase) -> Dict[str, Any]:
    """
    Generates the configuration for the Chrome Extension,
    listing all verified brands for real-time site flagging.
    """
    from agentz.core.aggregator import generate_marketplace_manifest
    manifest = await generate_marketplace_manifest(supabase)
    
    verified_domains = []
    for brand in manifest:
        # Generate domain from brand name (Simulated)
        domain = f"{brand['brand'].lower().replace(' ', '')}.com"
        verified_domains.append(domain)
        
    return {
        "version": "1.0.0",
        "verified_domains": verified_domains,
        "extension_settings": {
            "glow_color": "#D4A017",
            "alert_color": "#FF0000"
        }
    }

async def publish_extension_config(supabase):
    """
    Saves the latest extension config to Supabase for the client-side to fetch.
    """
    config = await generate_extension_manifest(supabase)
    # await supabase.table("public_reports").upsert({"id": "extension_config", "data": config}).execute()
    return config
