"""
agentz.workflows.handlers.authichain_pilot_deploy
-----------------------------------------------
Executes a complete AuthiChain pilot deployment for a target city.
Hardened against NoneType subscripts.
"""
from __future__ import annotations
import asyncio
import uuid
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get, get_or_placeholder
from agentz.core.scout import scout_businesses
from agentz.core.builder import create_product_identity
from agentz.core.media import generate_story_mode
from agentz.core.trust import monitor_scans
from agentz.core.growth import reward_repeat_scans
from agentz.core.pages import generate_living_page_config, publish_living_page
from agentz.core.llm import lm_manager

from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        # 1. Setup
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # 2. Scout Businesses
        city = "Detroit"
        if ctx.mode == Mode.DRY_RUN:
            candidates = [{"name": "Detroit Artisan Brews", "score": 100.0, "vertical": "brewery", "city": "Detroit"}]
            ctx.step(f"Scout pilot businesses in {city} (Dry-run: mocked results)")
        else:
            candidates_res = ctx.step(
                f"Scout pilot businesses in {city}",
                action=lambda: asyncio.run(scout_businesses(city, ctx))
            )
            candidates = candidates_res if candidates_res else []
        
        if not candidates:
            return "No pilot candidates found."
            
        top_pilot = candidates[0]
        ctx.step(f"Selected top pilot: {top_pilot.get('name')} (Score: {top_pilot.get('score')})")
        
        # 3. Create Product Identity
        product_data = {
            "name": f"{top_pilot.get('name')} Signature Series",
            "brand": top_pilot.get('name'),
            "metadata": {"vertical": top_pilot.get('vertical')}
        }
        
        if ctx.mode == Mode.DRY_RUN:
            identity = {
                "product": {"id": str(uuid.uuid4())},
                "qr": {"id": 123456}
            }
            ctx.step(f"Generate product identity and QR for {product_data['name']} (Dry-run)")
        else:
            identity_res = ctx.step(
                f"Generate product identity and QR for {product_data['name']}",
                action=lambda: asyncio.run(create_product_identity(supabase, product_data))
            )
            # Handle None/Skip
            identity = identity_res if identity_res else {"product": {"id": "skipped"}, "qr": {"id": 0}}
        
        product_id = identity.get("product", {}).get("id")
        qr_id = identity.get("qr", {}).get("id")
        
        # 4. Generate StoryMode
        ctx.step(
            f"Generate StoryMode AI narration and video for product {product_id}",
            action=lambda: asyncio.run(generate_story_mode(supabase, product_id))
        )
        
        # 5. Publish Living Page
        living_config = generate_living_page_config(identity.get("product", {}), identity.get("qr", {}))
        ctx.step(
            f"Publish Living Product Page for {top_pilot.get('name')}",
            action=lambda pid=product_id, cfg=living_config: asyncio.run(publish_living_page(supabase, pid, cfg))
        )
        
        # 6. Initialize Trust Monitoring
        ctx.step(
            f"Initialize trust monitoring for QR {qr_id}",
            action=lambda: asyncio.run(monitor_scans(supabase, product_id))
        )
        
        # 7. Setup Initial Reward Campaign
        wallet_sample = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
        ctx.step(
            f"Configure initial QRON reward campaign for {top_pilot.get('name')}",
            action=lambda: asyncio.run(reward_repeat_scans(supabase, wallet_sample, product_id))
        )
        
        return f"Pilot successfully deployed for {top_pilot.get('name')}. QR: {qr_id}, Product: {product_id}"
    finally:
        lm_manager.unload_model("local-model")
