"""
agentz.core.hubspot
------------------
HubSpot Agent: Fetches hot leads and deal data for autonomous outreach.
Supports full backlog retrieval via pagination.
Enhanced with sentiment-aware prioritization (Phase 17).
"""
from __future__ import annotations
import httpx
import logging
import asyncio
import json
from typing import List, Dict, Any, Optional
from agentz.core.credentials import get, update_credential
from agentz.core.hubspot_healer import rotate_hubspot_token
from agentz.core.llm import get_llm

logger = logging.getLogger("agentz.hubspot")

async def get_all_deals(limit: int = 200, _retry: bool = True) -> List[Dict[str, Any]]:
    """
    Queries HubSpot for ALL active deals. Handles pagination and 401 auto-healing.
    """
    token = get("hubspot_token")
    if not token:
        logger.warning("HubSpot token missing. Returning mock deals.")
        return [{"id": str(i), "name": f"Mock Deal {i}", "slug": f"mock-{i}", "city": "Detroit"} for i in range(10)]

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    body = {
        "properties": ["dealname", "amount", "dealstage", "slug", "city"],
        "limit": 100 # HubSpot per-page limit
    }
    
    all_deals = []
    after = None
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(all_deals) < limit:
                if after: body["after"] = after
                
                r = await client.post("https://api.hubapi.com/crm/v3/objects/deals/search", headers=headers, json=body)
                
                # Auto-Heal Path
                if r.status_code == 401 and _retry:
                    logger.warning("HubSpot 401 detected. Attempting autonomous token rotation...")
                    new_token = await rotate_hubspot_token()
                    if new_token:
                        update_credential("hubspot_token", new_token)
                        return await get_all_deals(limit=limit, _retry=False)
                    else:
                        logger.error("HubSpot healing failed.")
                        break

                if r.status_code == 200:
                    data = r.json()
                    results = data.get("results", [])
                    for d in results:
                        name = d["properties"].get("dealname", "deal")
                        slug = d["properties"].get("slug")
                        if not slug:
                            slug = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
                            while "--" in slug: slug = slug.replace("--", "-")
                            
                        all_deals.append({
                            "id": d["id"],
                            "name": name,
                            "amount": d["properties"].get("amount"),
                            "stage": d["properties"].get("dealstage"),
                            "slug": slug,
                            "city": d["properties"].get("city", "Unknown")
                        })
                    
                    after = data.get("paging", {}).get("next", {}).get("after")
                    if not after: break
                else:
                    logger.error(f"HubSpot API error: {r.status_code}")
                    break
                    
        return all_deals
    except Exception as e:
        logger.error(f"HubSpot exception: {e}")
        return []

async def get_hot_leads(limit: int = 10) -> List[Dict[str, Any]]:
    """Legacy helper for specific hot lead search."""
    return await get_all_deals(limit=limit)

async def get_lead_contact_info(deal_id: str) -> Optional[Dict[str, str]]:
    """Fetches primary contact email and name for a deal."""
    token = get("hubspot_token")
    if not token: return None
    
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}/associations/contacts", headers=headers)
            if r.status_code == 200:
                contacts = r.json().get("results", [])
                if contacts:
                    c_id = contacts[0]["id"]
                    r2 = await client.get(f"https://api.hubapi.com/crm/v3/objects/contacts/{c_id}?properties=email,firstname,lastname", headers=headers)
                    if r2.status_code == 200:
                        cp = r2.json().get("properties", {})
                        return {
                            "email": cp.get("email"),
                            "name": f"{cp.get('firstname')} {cp.get('lastname')}"
                        }
    except Exception as e:
        logger.error(f"Failed to fetch contact info for deal {deal_id}: {e}")
    return None

async def get_deal_notes(deal_id: str) -> str:
    """
    Fetches engagement notes associated with a deal.
    """
    token = get("hubspot_token")
    if not token: 
        return "Mock note: Client expressed interest in pilot expansion."

    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}/associations/notes", headers=headers)
            if r.status_code == 200:
                note_ids = [res["id"] for res in r.json().get("results", [])]
                if not note_ids: return ""
                
                notes_text = []
                for nid in note_ids[:5]:
                    r2 = await client.get(f"https://api.hubapi.com/crm/v3/objects/notes/{nid}?properties=hs_note_body", headers=headers)
                    if r2.status_code == 200:
                        body = r2.json().get("properties", {}).get("hs_note_body", "")
                        notes_text.append(body)
                
                return "\n---\n".join(notes_text)
    except Exception as e:
        logger.error(f"Failed to fetch notes for deal {deal_id}: {e}")
    
    return ""

async def prioritize_leads_by_sentiment(deals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyzes deal notes using LLM to prioritize leads based on urgency and conversion intent.
    """
    if not deals: return []
    
    # 1. Fetch notes for top candidates (batch size 10 for speed)
    candidates = deals[:10]
    for d in candidates:
        d["notes"] = await get_deal_notes(d["id"])

    # 2. Formulate prioritization prompt
    prompt = """
    You are the AgentZ Sales Strategist. Analyze the following HubSpot deals and their associated engagement notes.
    Score each deal on 'Urgency' (1-10) and 'Intent' (1-10) based on 'Buy Signals' in the notes.
    
    DEALS:
    """
    for i, d in enumerate(candidates):
        prompt += f"\n{i+1}. Deal: {d['name']} (ID: {d['id']})\n   Notes: {d['notes'][:200]}...\n"

    prompt += """
    Return a JSON list of deal IDs in prioritized order (highest potential first).
    Format: [{"id": "...", "score": 8.5, "rationale": "..."}]
    Return ONLY JSON.
    """
    
    llm = get_llm(model="gpt-4o", temperature=0.0)
    try:
        logger.info(f"Prioritizing {len(candidates)} leads via sentiment analysis...")
        res = llm.invoke(prompt).content.strip()
        # Extract JSON
        if "```json" in res:
            res = res.split("```json")[1].split("```")[0].strip()
        
        scores = json.loads(res)
        score_map = {s["id"]: s for s in scores}
        
        for d in candidates:
            meta = score_map.get(d["id"], {"score": 5.0, "rationale": "Baseline priority"})
            d["sentiment_score"] = meta["score"]
            d["priority_rationale"] = meta["rationale"]
            
        # Sort candidates by score
        candidates.sort(key=lambda x: x.get("sentiment_score", 0), reverse=True)
        # Combine with remaining deals
        return candidates + deals[10:]
        
    except Exception as e:
        logger.error(f"Sentiment prioritization failed: {e}")
        return deals

async def create_contact(email: str, firstname: str, lastname: str) -> Optional[str]:
    """Creates a new contact in HubSpot. Returns the contact ID."""
    token = get("hubspot_token")
    if not token: return None

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "properties": {
            "email": email,
            "firstname": firstname,
            "lastname": lastname
        }
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post("https://api.hubapi.com/crm/v3/objects/contacts", headers=headers, json=body)
            if r.status_code in (201, 200):
                return r.json().get("id")
            elif r.status_code == 409: # Conflict - already exists
                # Extract ID from error message if possible or search
                pass
    except Exception as e:
        logger.error(f"Failed to create contact {email}: {e}")
    return None

async def create_deal(name: str, amount: str, stage: str = "appointmentscheduled", contact_id: Optional[str] = None) -> Optional[str]:
    """Creates a new deal in HubSpot and optionally associates it with a contact."""
    token = get("hubspot_token")
    if not token: return None

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "properties": {
            "dealname": name,
            "amount": amount,
            "dealstage": stage
        }
    }
    if contact_id:
        body["associations"] = [{
            "to": {"id": contact_id},
            "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3}] # Deal to Contact
        }]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post("https://api.hubapi.com/crm/v3/objects/deals", headers=headers, json=body)
            if r.status_code in (201, 200):
                return r.json().get("id")
    except Exception as e:
        logger.error(f"Failed to create deal {name}: {e}")
    return None
