"""
agentz.workflows.handlers.hubspot_backlog_processor
-------------------------------------------------
Executes the Mass Activation cycle for the entire HubSpot backlog.
Coordinates Identity -> Microsite -> Media -> Outreach for 172+ deals.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.hubspot import get_all_deals, get_lead_contact_info
from agentz.core.microsites import deploy_sales_microsite
from agentz.core.media import generate_story_mode
from agentz.core.social import generate_social_post
from agentz.core.credentials import get_or_placeholder
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    # 1. Setup
    supabase_url = get_or_placeholder("supabase_url", ctx)
    supabase_key = get_or_placeholder("supabase_service_key", ctx)
    supabase: Client = create_client(supabase_url, supabase_key)
    
    ctx.step("🚀 --- INITIALIZING HUB SPOT BACKLOG PROCESSOR --- 🚀")
    
    # 2. Fetch Entire Backlog & Sample Product for Context
    ctx.step("Querying HubSpot for all active deals (172+)...")
    if ctx.mode == Mode.DRY_RUN:
        deals = [{"id": "mock_1", "name": "Global Retail Group", "slug": "global-retail"}]
        demo_product_id = "dry-run-product-id"
    else:
        deals_res = ctx.step(
            "Fetch deals via HubSpot Agent",
            action=lambda: asyncio.run(get_all_deals(limit=200))
        )
        deals = deals_res if deals_res else []

        prod_res = ctx.step(
            "Fetch latest product from verified ledger for StoryMode context",
            action=lambda: supabase.table("products").select("id").limit(1).execute()
        )
        if prod_res and prod_res.data:
            demo_product_id = prod_res.data[0]["id"]
        else:
            demo_product_id = "43ed4724-724c-49ed-a5fe-d712f6121578" # Detroit Pilot Fallback
        
    if not deals:
        return "No backlog found in HubSpot."
        
    ctx.step(f"Loaded {len(deals)} deals for mass activation.")
    
    processed = 0
    for deal in deals:
        name = deal.get("name", "Unknown")
        ctx.step(f"--- Processing Deal {processed + 1}/{len(deals)}: {name} ---")
        
        try:
            # 3. Deploy Personalized Microsite
            site_url = ctx.step(
                f"Deploy Vercel & R2 assets for {name}",
                action=lambda l=deal: asyncio.run(deploy_sales_microsite(l))
            )
            
            # 4. Generate StoryMode (Queued)
            ctx.step(
                f"Provision StoryMode for {name}",
                action=lambda pid=demo_product_id: asyncio.run(generate_story_mode(supabase, pid))
            )
            
            # 5. Draft Personalized Outreach
            contact = asyncio.run(get_lead_contact_info(deal["id"]))
            contact_name = contact["name"] if contact else "Innovation Team"
            
            topic = f"High-fidelity digital twin for {name} is live at {site_url}"
            message = ctx.step(
                f"Draft outreach DM for {contact_name}",
                action=lambda t=topic: asyncio.run(generate_social_post(t, "Twitter DM"))
            )
            
            ctx.step(f"   -> Outreach drafted and logged as PENDING for {name}.")
            processed += 1
            
            # Rate limiting / Sleep for 1s between deals to prevent API congestion
            if ctx.mode != Mode.DRY_RUN:
                asyncio.run(asyncio.sleep(1))
                
        except Exception as e:
            ctx.step(f"Failed to process {name}: {e}")
            continue
            
    return f"Backlog processing complete. {processed} deals activated and ready for closing."
