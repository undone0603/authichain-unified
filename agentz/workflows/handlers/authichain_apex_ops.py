"""
agentz.workflows.handlers.authichain_apex_ops
---------------------------------------------
Executes the most advanced "Apex" evolutions: Marketplace & Legal Shield.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.marketplace import MarketplaceAgent
from agentz.core.legal import scout_marketplace_infringement, draft_enforcement_notice
from supabase import create_client, Client
from agentz.core.credentials import get_or_placeholder
from agentz.core.llm import lm_manager

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        # 1. Setup
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)
        
        ctx.step("[^] --- EXECUTING APEX EVOLUTION OPS --- [^]")
        
        # 2. Verified Checkout (Layer 3 Revenue)
        ctx.step("Initializing 'Verified Checkout' on qron.space...")
        mkt = MarketplaceAgent()
        product_id_sample = "43ed4724-724c-49ed-a5fe-d712f6121578"
        
        if ctx.mode == Mode.DRY_RUN:
            order_res = {"checkout_url": "https://qron.space/checkout/mock", "platform_fee_projected": 125.0}
            ctx.step("Create verified order session (Dry-run)")
        else:
            order_res = ctx.step(
                f"Process verified purchase for product {product_id_sample}",
                action=lambda: asyncio.run(mkt.create_verified_order(supabase, product_id_sample, "0xBuyer...", 2500.0))
            )
        ctx.step(f"   -> Checkout Live. Projected Layer 3 Siphon: ${order_res['platform_fee_projected']}")

        # 3. Legal Shield (IP Enforcement)
        brand_target = "Detroit Artisan Brews"
        ctx.step(f"Activating Legal Shield for {brand_target}...")
        
        if ctx.mode == Mode.DRY_RUN:
            infringements = [{"seller": "FakeSeller", "url": "https://ebay.com/fake"}]
            ctx.step("Scout marketplace infringement (Dry-run)")
        else:
            infringements = ctx.step(
                f"Scanning eBay/Amazon for {brand_target} counterfeits",
                action=lambda: asyncio.run(scout_marketplace_infringement(brand_target, ctx))
            )
            
        for inf in infringements[:1]: # Process first match for demo
            ctx.step(f"   -> Infringement Detected: {inf['seller']} ({inf['url']})")
            notice = ctx.step(
                f"Drafting Cease & Desist for {inf['seller']}",
                action=lambda: asyncio.run(draft_enforcement_notice(inf, brand_target))
            )
            ctx.step(f"Legal Enforcement Drafted. Logging to HubSpot deal room.")

        return "Apex evolution complete. Infrastructure is now transactional and legally self-defending."
    finally:
        lm_manager.unload_model("local-model")
