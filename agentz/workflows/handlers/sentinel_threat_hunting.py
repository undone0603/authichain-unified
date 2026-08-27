"""
agentz.workflows.handlers.sentinel_threat_hunting
------------------------------------------------
Active Protocol Defense Agent. Scans public marketplaces for unauthorized 
"Verified by AuthiChain" claims or counterfeit QRON visual markers.

Logic:
1. Search Marketplaces (eBay/Amazon) for protocol keywords.
2. For each listing, extract product title, seller, and QRON signature (if visible).
3. Cross-reference with Supabase product_qrons table.
4. If "Verified" claim exists but ID is missing/invalid -> Flag as Protocol Threat.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import httpx

from agentz.core.credentials import get
from agentz.core.modes import ExecutionContext, Mode

MARKETPLACES = [
    "https://www.ebay.com/sch/i.html?_nkw=verified+by+authichain",
    "https://www.ebay.com/sch/i.html?_nkw=qron+certified"
]

def run(ctx: ExecutionContext) -> str:
    ctx.step("Sentinel activated: Initiating marketplace threat sweep")
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"would scan {len(MARKETPLACES)} marketplace URLs for protocol misuse")
        return "dry-run: sentinel threat hunt simulated"

    return asyncio.run(_run_sentinel_browser(ctx))

async def _run_sentinel_browser(ctx: ExecutionContext) -> str:
    try:
        from browser_use import Agent           # type: ignore
        from langchain_ollama import ChatOllama # type: ignore
    except ImportError as e:
        raise RuntimeError("browser-use stack not installed") from e

    threats_found = []
    
    for url in MARKETPLACES:
        ctx.step(f"Scanning marketplace: {url}")
        
        task = f"""
        Open this URL: {url}
        
        Look for any listings that claim to be "Verified by AuthiChain" or use "QRON" technology.
        For each listing:
        1. Extract: listing_title, seller_name, price, listing_url.
        2. Look for a visible QR code or visual fingerprint.
        3. If a QRON ID is mentioned (e.g. AC-XXXX or QR-XXXX), extract it.
        
        Output a JSON array of these listings.
        """
        
        llm   = ChatOllama(model="llama3.2", temperature=0.1)
        agent = Agent(task=task, llm=llm)
        history = await agent.run(max_steps=50)
        
        listings = _parse_listings(history)
        
        for item in listings:
            # Cross-reference with the Truth Layer
            is_valid = await _verify_listing_authenticity(item.get("qron_id"))
            
            if not is_valid:
                threats_found.append(item)
                ctx.step(f"🚨 THREAT DETECTED: Unauthorized claim by seller '{item.get('seller_name')}'")

    if threats_found:
        ctx.step(f"Reporting {len(threats_found)} protocol threats to AuthiChain mission system", 
                 action=lambda: _report_threats(threats_found))

    return f"sentinel sweep complete: {len(threats_found)} threats flagged"

def _parse_listings(history) -> list[dict]:
    import json, re
    text = str(history)
    match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if not match: return []
    try: return json.loads(match.group(0))
    except: return []

async def _verify_listing_authenticity(qron_id: str | None) -> bool:
    """Queries the AuthiChain database to verify if a QRON ID is legitimate."""
    if not qron_id: return False # Claiming verification without an ID is a threat
    
    url = get("supabase_url") + "/rest/v1/product_qrons"
    headers = {
        "apikey": get("supabase_anon"),
        "Authorization": f"Bearer {get('supabase_anon')}",
    }
    
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=headers, params={"id": f"eq.{qron_id}"}, timeout=10.0)
        if r.status_code != 200: return False
        data = r.json()
        return len(data) > 0

def _report_threats(threats: list[dict]) -> bool:
    """Enqueues enforcement missions in the AuthiChain platform."""
    url = get("supabase_url") + "/rest/v1/protocol_anomalies"
    headers = {
        "apikey": get("supabase_anon"),
        "Authorization": f"Bearer {get('supabase_anon')}",
        "Content-Type": "application/json",
    }
    
    rows = []
    for t in threats:
        rows.append({
            "type": "unauthorized_protocol_claim",
            "severity": "critical",
            "description": f"Counterfeit claim on marketplace: {t.get('listing_title')}",
            "metadata": {
                "seller": t.get("seller_name"),
                "url": t.get("listing_url"),
                "detected_at": datetime.now(timezone.utc).isoformat()
            }
        })
        
    r = httpx.post(url, headers=headers, json=rows, timeout=15.0)
    return r.status_code in (200, 201, 204)
