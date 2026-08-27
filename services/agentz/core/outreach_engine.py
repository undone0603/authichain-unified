"""
agentz.core.outreach_engine
---------------------------
Client for the Cloudflare-based AuthiChain Outreach Engine.
"""
from __future__ import annotations
import httpx
import logging
from typing import List, Dict, Any, Optional
from agentz.core.credentials import get

logger = logging.getLogger("agentz.outreach_engine")

class OutreachEngineClient:
    def __init__(self):
        self.base_url = get("outreach_worker_url") or "https://outreach.authichain.workers.dev"
        self.token = get("outreach_admin_token")

    async def add_lead(self, lead_data: Dict[str, Any]) -> bool:
        """
        Adds a new lead to the Cloudflare D1 database.
        """
        if not self.token: return False
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(f"{self.base_url}/admin/leads", headers=headers, json=lead_data)
                return r.status_code == 201
        except Exception as e:
            logger.error(f"Outreach Engine error: {e}")
            return False

    async def trigger_batch(self) -> Dict[str, Any]:
        """
        Manually triggers the outreach batch processing.
        """
        if not self.token: return {"error": "Missing token"}
        
        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(f"{self.base_url}/admin/run", headers=headers)
                return r.json()
        except Exception as e:
            return {"error": str(e)}

    async def list_pending_leads(self) -> List[Dict[str, Any]]:
        """
        Fetches the current queue from the worker.
        """
        if not self.token: return []
        
        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{self.base_url}/admin/leads", headers=headers)
                return r.json()
        except Exception as e:
            return []
