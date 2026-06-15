"""
agentz.workflows.handlers.mass_content_blitz
-------------------------------------------
High-scale content production handler. Generates a full marketing suite 
for the entire active HubSpot backlog using the Template-First engine.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext
from agentz.core.multiplier import multiply_content, archive_multiplied_assets
from agentz.core.hubspot import get_all_deals
from agentz.core.templates import sync_with_cloud

def run(ctx: ExecutionContext) -> Optional[str]:
    ctx.step("--- INITIALIZING MASTER CONTENT BLITZ ---")
    
    # 1. Cloud Sync
    ctx.step("Synchronizing templates with Cloudflare R2...")
    asyncio.run(sync_with_cloud())
    
    # 2. Fetch Backlog
    ctx.step("Fetching active pipeline from HubSpot...")
    deals = asyncio.run(get_all_deals(limit=200)) # Process full backlog
    
    if not deals:
        return "No active deals found in pipeline."
        
    ctx.step(f"Found {len(deals)} deals for mass production.")
    
    generated = 0
    for d in deals:
        brand = d.get("name", "Strategic Partner")
        # Ensure we have a product object for the multiplier
        product = {
            "brand": brand,
            "name": f"{brand} Digital Twin",
            "metadata": {
                "industry": d.get("stage", "general"),
                "origin": "Global"
            }
        }
        
        ctx.step(f"[{generated+1}/{len(deals)}] Processing {brand}...")
        
        try:
            # 3. Generate Suite (Template-First)
            assets = asyncio.run(multiply_content(product))
            
            # 4. Archive
            asyncio.run(archive_multiplied_assets(brand, product["name"], assets))
            generated += 1
        except Exception as e:
            ctx.step(f"Failed mass production for {brand}: {e}")
            continue
            
    return f"Master Blitz complete. Generated 3-asset marketing suites for {generated} pipeline deals."
