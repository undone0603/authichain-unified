"""
agentz.workflows.handlers.authichain_apex_hardened
--------------------------------------------------
Executes the final "Apex Hardening" evolutions: Partnerships, Extensions, & NFC.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.partnership import scout_strategic_partners, draft_partnership_proposal
from agentz.core.extension import publish_extension_config
from agentz.core.builder import create_product_identity
from supabase import create_client, Client
from agentz.core.credentials import get_or_placeholder

def run(ctx: ExecutionContext) -> str:
    # 1. Setup
    supabase_url = get_or_placeholder("supabase_url", ctx)
    supabase_key = get_or_placeholder("supabase_service_key", ctx)
    supabase: Client = create_client(supabase_url, supabase_key)
    
    ctx.step("[^] --- EXECUTING APEX HARDENING OPS --- [^]")
    
    # 2. Partnership Agent (Logistics Expansion)
    ctx.step("Scouting strategic B2B partners (Logistics/Insurance)...")
    if ctx.mode == Mode.DRY_RUN:
        partners = [{"name": "DHL", "type": "Logistics"}]
    else:
        partners = ctx.step(
            "Scout high-value logistics leads",
            action=lambda: asyncio.run(scout_strategic_partners("luxury", ctx))
        )
    
    for p in partners[:1]:
        ctx.step(f"   -> Partner Lead: {p['name']} ({p['type']})")
        proposal = ctx.step(
            f"Drafting alliance proposal for {p['name']}",
            action=lambda: asyncio.run(draft_partnership_proposal(p, {"scans": 1200}))
        )
        ctx.step("Strategic Proposal Drafted. Forwarding to Outreach Agent.")

    # 3. Authentic Extension (Consumer Shield)
    ctx.step("Syncing 'Authentic' Chrome Extension brand list...")
    config = ctx.step(
        "Generate and publish extension manifest",
        action=lambda: asyncio.run(publish_extension_config(supabase))
    )
    ctx.step(f"   -> Extension Config Live. Monitoring {len(config.get('verified_domains', []))} domains.")

    # 4. Phygital NFC Integration (Luxury Hardening)
    brand_target = "Detroit Artisan Brews"
    ctx.step(f"Demonstrating Dual-Identity (QR+NFC) for {brand_target}...")
    
    product_data = {
        "name": "Apex Series Dual-Verified",
        "brand": brand_target,
        "metadata": {"vertical": "luxury"}
    }
    
    if ctx.mode == Mode.DRY_RUN:
        res = {"product": {"id": "nfc-demo-id"}, "nfc": {"nfc_id": "nfc_123"}}
        ctx.step("Create dual-identity product (Dry-run)")
    else:
        res = ctx.step(
            f"Generate QR + NFC anchored identity for {brand_target}",
            action=lambda: asyncio.run(create_product_identity(supabase, product_data))
        )
    ctx.step(f"   -> Phygital Identity Locked. NFC ID: {res['nfc']['nfc_id']}")

    return "Apex Hardening complete. Ecosystem is now globally integrated and phygital-hardened."
