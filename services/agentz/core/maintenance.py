"""
agentz.core.maintenance
----------------------
Maintenance Agent: Performs periodic health checks on the ecosystem.
"""
from __future__ import annotations
import httpx
import logging
from typing import Dict, Any, List

logger = logging.getLogger("agentz.maintenance")

async def check_pilot_health(supabase) -> List[Dict[str, Any]]:
    """
    Checks the status of pilot businesses (website availability, scan velocity).
    """
    businesses = supabase.table("businesses").select("*").execute().data
    
    issues = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for b in businesses:
            website = b.get("website")
            if website and website != "N/A":
                try:
                    r = await client.get(website)
                    if r.status_code >= 400:
                        issues.append({"business": b["name"], "issue": "Website error", "code": r.status_code})
                except Exception as e:
                    issues.append({"business": b["name"], "issue": "Website unreachable", "error": str(e)})
                    
    return issues

async def run_maintenance_cycle(supabase):
    """
    Coordinates all maintenance tasks.
    """
    logger.info("Starting maintenance cycle...")
    
    # 1. Web Health
    web_issues = await check_pilot_health(supabase)
    for issue in web_issues:
        logger.warning(f"Maintenance Issue: {issue}")
        
    return web_issues
