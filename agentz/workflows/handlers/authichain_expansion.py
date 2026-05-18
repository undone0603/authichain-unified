"""
agentz.workflows.handlers.authichain_expansion
----------------------------------------------
Autonomous scaling of AuthiChain pilots in a target city.
Enhanced with sentiment-aware lead prioritization (Phase 17).
"""
from __future__ import annotations
import asyncio
import uuid
from typing import List, Dict, Any
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.scout import scout_businesses
from agentz.core.hubspot import get_hot_leads, prioritize_leads_by_sentiment
from agentz.core.builder import create_product_identity
from agentz.core.media import generate_story_mode
from agentz.core.trust import monitor_scans
from agentz.core.growth import reward_repeat_scans
from agentz.core.pages import generate_living_page_config, publish_living_page

from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    # 1. Setup credentials
    supabase_url = get_or_placeholder("supabase_url", ctx)
    supabase_key = get_or_placeholder("supabase_service_key", ctx)
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Select target city based on HubSpot density or fallback
    ctx.step("Selecting expansion territory via sentiment-aware prioritization...")
    if ctx.mode == Mode.DRY_RUN:
        city = "Ann Arbor"
    else:
        leads = ctx.step("Fetch HubSpot leads", action=lambda: asyncio.run(get_hot_leads(limit=10)))
        if leads:
            # New Phase 17 logic: Prioritize by Buy Signals
            p_leads = ctx.step("Analyze lead sentiment for Buy Signals", action=lambda: asyncio.run(prioritize_leads_by_sentiment(leads)))
            target_lead = p_leads[0]
            city = target_lead.get("city", "Ann Arbor")
            ctx.step(f"Priority Lead: {target_lead['name']} (Score: {target_lead.get('sentiment_score')})")
            ctx.step(f"Rationale: {target_lead.get('priority_rationale')}")
        else:
            city = "Ann Arbor"

    ctx.step(f"Expansion Territory Selected: {city}")
    
    # 2. Scout for multiple businesses
    if ctx.mode == Mode.DRY_RUN:
        candidates = [
            {"name": "Founders Brewing Co", "vertical": "brewery", "city": city, "score": 90.0},
            {"name": "House of Dank", "vertical": "dispensary", "city": city, "score": 85.0},
            {"name": "Detroit Institute of Arts Shop", "vertical": "museum", "city": city, "score": 95.0},
        ]
        ctx.step(f"Scout for pilot expansion in {city} (Dry-run: mocked)")
    else:
        candidates = ctx.step(
            f"Scoring and selecting expansion candidates in {city}",
            action=lambda: asyncio.run(scout_businesses(city, ctx))
        )
        
    if not candidates:
        return "No expansion candidates found."
        
    ctx.step(f"Found {len(candidates)} candidates. Proceeding with top {min(3, len(candidates))}.")
    
    deployed = []
    # 3. Deploy to top 3
    for pilot in candidates[:3]:
        name = pilot["name"]
        vertical = pilot.get("vertical", "general")
        
        ctx.step(f"--- Deploying Pilot for: {name} ---")
        
        # Identity
        product_data = {
            "name": f"{name} Verified Series",
            "brand": name,
            "metadata": {"vertical": vertical, "source": "autonomous_expansion"}
        }
        
        if ctx.mode == Mode.DRY_RUN:
            identity = {
                "product": {"id": str(uuid.uuid4())},
                "qr": {"id": f"qr-{name.lower().replace(' ', '-')}"}
            }
            ctx.step(f"Create identity for {name} (Dry-run)")
        else:
            identity = ctx.step(
                f"Create identity for {name}",
                action=lambda p=product_data: asyncio.run(create_product_identity(supabase, p))
            )
            
        product_id = identity["product"]["id"]
        qr_id = identity["qr"]["id"]
        
        # StoryMode
        ctx.step(
            f"Generate StoryMode for {name}",
            action=lambda pid=product_id: asyncio.run(generate_story_mode(supabase, pid))
        )
        
        # Living Page
        living_config = generate_living_page_config(identity["product"], identity["qr"])
        ctx.step(
            f"Publish Living Product Page for {name}",
            action=lambda pid=product_id, cfg=living_config: asyncio.run(publish_living_page(supabase, pid, cfg))
        )
        
        # Trust & Rewards
        ctx.step(
            f"Initialize trust & rewards for {name}",
            action=lambda pid=product_id: asyncio.run(reward_repeat_scans(supabase, "0x0000000000000000000000000000000000000000"))
        )
        
        deployed.append(f"{name} ({qr_id})")
        
    return f"Expansion complete. Deployed {len(deployed)} new pilots: {', '.join(deployed)}"
