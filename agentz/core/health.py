"""
agentz.core.health
------------------
System health monitoring and diagnostics for the AgentZ infrastructure.
"""
from __future__ import annotations
import os
import httpx
import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger("agentz.health")

async def check_llm_status() -> Dict[str, Any]:
    """Verifies that at least one LLM provider is reachable."""
    from agentz.core.llm import get_llm
    llm = get_llm()
    try:
        # Simple non-streaming invoke
        await llm.ainvoke("respond with 'pong'")
        return {"status": "ok", "provider": llm.provider}
    except Exception as e:
        return {"status": "error", "message": str(e)}

async def check_supabase_connectivity() -> Dict[str, Any]:
    """Checks the connection to Supabase."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return {"status": "error", "message": "Missing Supabase credentials"}
    
    try:
        async with httpx.AsyncClient() as client:
            # Check a basic health endpoint or just the API root
            r = await client.get(f"{url}/rest/v1/", headers={"apikey": key})
            if r.status_code == 200:
                return {"status": "ok"}
            return {"status": "error", "code": r.status_code}
    except Exception as e:
        return {"status": "error", "message": str(e)}

async def run_diagnostics() -> Dict[str, Any]:
    """Runs a full suite of system diagnostics."""
    results = await asyncio.gather(
        check_llm_status(),
        check_supabase_connectivity(),
    )
    return {
        "llm": results[0],
        "supabase": results[1],
        "platform": "win32-arm64 (emulated)",
    }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(asyncio.run(run_diagnostics()))
