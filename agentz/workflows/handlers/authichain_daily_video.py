"""
agentz.workflows.handlers.authichain_daily_video
-----------------------------------------------
Autonomously generates a 'Daily Provenance' video for a featured product.
"""
from __future__ import annotations
import asyncio
import random
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.llm import lm_manager
from agentz.core.media import generate_story_mode
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        # 1. Setup
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)
        
        ctx.step("🎬 --- INITIALIZING DAILY PROVENANCE VIDEO FACTORY --- 🎬")
        
        # 2. Select Product of the Day
        if ctx.mode == Mode.DRY_RUN:
            product_id = "dry-run-featured-id"
            product_name = "Detroit Artisan Brews Signature"
            ctx.step(f"Selected Product of the Day (Dry-run): {product_name}")
        else:
            # Fetch a random product from real data
            products = supabase.table("products").select("id, name").not_.ilike("name", "%test%").limit(50).execute().data
            if not products:
                return "No valid products found for video generation."
            
            featured = random.choice(products)
            product_id = featured["id"]
            product_name = featured["name"]
            ctx.step(f"Selected Product of the Day: {product_name} (ID: {product_id})")
            
        # 3. Trigger High-Fidelity Video Generation
        # Uses the Media Queue logic we implemented earlier
        video_url = ctx.step(
            f"Generate Cinematic Provenance Video for {product_name}",
            action=lambda: asyncio.run(generate_story_mode(supabase, product_id))
        )
        
        # 4. Log for Social Distribution
        ctx.step(f"Video enqueued. Distribution scheduled for YouTube/TikTok.")
        
        return f"Daily Provenance cycle complete. Featured: {product_name}. Video: {video_url}"
    finally:
        lm_manager.unload_model("local-model")
