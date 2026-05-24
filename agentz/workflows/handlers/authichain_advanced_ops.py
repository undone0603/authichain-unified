"""
agentz.workflows.handlers.authichain_advanced_ops
------------------------------------------------
Executes advanced ecosystem operations: Concierge, Microsites, Oracles, & Marketplace.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.hubspot import get_hot_leads
from agentz.core.concierge import get_concierge_response
from agentz.core.microsites import deploy_sales_microsite
from agentz.core.oracle import update_timeline_via_oracle
from agentz.core.aggregator import generate_marketplace_manifest, publish_manifest
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    # 1. Setup
    supabase_url = get_or_placeholder("supabase_url", ctx)
    supabase_key = get_or_placeholder("supabase_service_key", ctx)
    supabase: Client = create_client(supabase_url, supabase_key)
    
    ctx.step("--- Advanced Operations Phase ---")
    
    # 2. Fetch Sample Product for context
    ctx.step("Fetching real product context from Supabase...")
    if ctx.mode == Mode.DRY_RUN:
        sample_product = {"id": "mock-id", "name": "Detroit IPA", "brand": "Detroit Artisan Brews", "authenticity_score": 100}
    else:
        prod_res = ctx.step(
            "Fetch latest product from verified ledger",
            action=lambda: supabase.table("products").select("*").limit(1).execute()
        )
        if prod_res and prod_res.data:
            sample_product = prod_res.data[0]
        else:
            sample_product = {"id": "a750928d-2820-43fe-ab86-57270318bdf7", "name": "Standard QR Series", "brand": "AuthiChain", "authenticity_score": 95}

    product_id_sample = sample_product.get("id")

    # 3. AI Concierge Interaction
    ctx.step(f"Testing AI Concierge Personification for: {sample_product['name']}...")
    
    if ctx.mode == Mode.DRY_RUN:
        response = "Dry-run: AI Concierge response mocked."
    else:
        response = ctx.step(
            "Generate sample concierge response",
            action=lambda: asyncio.run(get_concierge_response(sample_product, "How is this brand verified?"))
        )
    ctx.step(f"Concierge Output: {response[:100]}...")
    
    # 4. Autonomous Microsite Deployment
    ctx.step("Deploying targeted sales microsite for expansion lead...")
    if ctx.mode == Mode.DRY_RUN:
        lead = {"name": "Grand Rapids Public Works", "slug": "grand-rapids-pw", "vertical": "government"}
    else:
        leads_res = ctx.step(
            "Fetch top hot lead from HubSpot",
            action=lambda: asyncio.run(get_hot_leads(limit=1))
        )
        if leads_res:
            lead = leads_res[0]
        else:
            lead = {"name": "Strategic Partner", "slug": "strategic-partner", "vertical": "luxury"}
    
    if ctx.mode == Mode.DRY_RUN:
        site_url = f"https://{lead.get('slug', 'demo')}.authichain.com"
        ctx.step(f"Deploy Vercel microsite for {lead['name']} (Dry-run)")
    else:
        site_url = ctx.step(
            f"Deploy Vercel microsite for {lead['name']}",
            action=lambda l=lead: asyncio.run(deploy_sales_microsite(l))
        )
    ctx.step(f"Microsite Live at: {site_url}")
    
    # 5. Oracle Logistics Integration
    ctx.step(f"Updating product timeline via Logistics Oracle for {product_id_sample}...")
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"Poll FedEx Oracle for product {product_id_sample} (Dry-run)")
    else:
        ctx.step(
            f"Poll FedEx Oracle for product {product_id_sample}",
            action=lambda: asyncio.run(update_timeline_via_oracle(supabase, product_id_sample, "1234567890"))
        )
    
    # 6. Marketplace Aggregation
    ctx.step("Generating central 'Authentic Economy' manifest for qron.space...")
    
    if ctx.mode == Mode.DRY_RUN:
        manifest = [{"brand": "Detroit Artisan Brews", "product_count": 5}]
        ctx.step("Aggregate verified brands (Dry-run)")
    else:
        manifest = ctx.step(
            "Aggregate verified brands",
            action=lambda: asyncio.run(generate_marketplace_manifest(supabase))
        )
    ctx.step(f"Aggregated {len(manifest)} brands for directory.")
    
    return "Advanced operations cycle complete. Ecosystem is now dynamic, chat-enabled, and logistics-aware."
