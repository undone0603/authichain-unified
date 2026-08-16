"""
agentz.workflows.handlers.authichain_apex_orchestrator
-----------------------------------------------------
Coordinates the "Apex" agents to ensure market dominance and protection.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.llm import lm_manager
from agentz.core.legal import scout_marketplace_infringement, draft_enforcement_notice
from agentz.core.partnership import scout_strategic_partners, draft_partnership_proposal
from agentz.core.marketplace import MarketplaceAgent
from agentz.core.extension import publish_extension_config
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        # 1. Setup
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)
        
        ctx.step("[^] --- STARTING APEX MARKET DOMINANCE ORCHESTRATION --- [^]")
        
        # 2. Intellectual Property Protection (Legal Shield)
        brand_to_protect = "Detroit Artisan Brews"
        ctx.step(f"Phase 1: Legal Shield - Protecting {brand_to_protect}...")
        
        if ctx.mode == Mode.DRY_RUN:
            infringements = [{"seller": "FakeSeller99", "url": "https://ebay.com/fake", "issue": "Counterfeit"}]
        else:
            infringements = ctx.step(
                f"Scout external marketplaces for {brand_to_protect} infringements",
                action=lambda: asyncio.run(scout_marketplace_infringement(brand_to_protect, ctx))
            )
            
        for inf in infringements:
            notice = ctx.step(
                f"Draft Cease & Desist for {inf['seller']}",
                action=lambda: asyncio.run(draft_enforcement_notice(inf, brand_to_protect))
            )
            ctx.step(f"   -> Legal enforcement queued for {inf['seller']}.")

        # 3. Strategic Alliances (Partnerships)
        ctx.step("Phase 2: Strategic Alliances - Expanding Trust Network...")
        if ctx.mode == Mode.DRY_RUN:
            partners = [{"name": "DHL", "type": "Logistics"}]
        else:
            partners = ctx.step(
                "Scout high-value logistics/insurance partners",
                action=lambda: asyncio.run(scout_strategic_partners("luxury", ctx))
            )
            
        for p in partners:
            proposal = ctx.step(
                f"Draft alliance proposal for {p['name']}",
                action=lambda: asyncio.run(draft_partnership_proposal(p, {"scans": 5400}))
            )
            ctx.step(f"   -> Strategic proposal drafted for {p['name']}.")

        # 4. Verified Commerce (Marketplace)
        ctx.step("Phase 3: Verified Commerce - Generating Transactional Sessions...")
        mkt = MarketplaceAgent()
        # Select a real product ID from previous successful deployments
        product_id = "43ed4724-724c-49ed-a5fe-d712f6121578"
        
        if ctx.mode == Mode.DRY_RUN:
            order = {"checkout_url": "https://qron.space/checkout/dry-run"}
        else:
            order = ctx.step(
                f"Generate Stripe Connect checkout for product {product_id}",
                action=lambda: asyncio.run(mkt.create_verified_order(supabase, product_id, "0xBuyer...", 2500.0))
            )
        ctx.step(f"   -> Checkout Live: {order.get('checkout_url')}")

        # 5. Omnichannel Protection (Extension)
        ctx.step("Phase 4: Consumer Shield - Syncing Extension Manifest...")
        ext_config = ctx.step(
            "Publish latest verified brand manifest to Extension API",
            action=lambda: asyncio.run(publish_extension_config(supabase))
        )
        ctx.step(f"   -> Manifest Synced. Shielding {len((ext_config or {}).get('verified_domains', []))} domains.")

        ctx.step("[^] --- APEX ORCHESTRATION CYCLE COMPLETE --- [^]")
        
        return "Ecosystem is now legally protected, strategically aligned, and transaction-ready."
    finally:
        lm_manager.unload_model("local-model")
