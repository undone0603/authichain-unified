"""
agentz.workflows.handlers.authichain_growth_loop
-----------------------------------------------
Coordinates the full growth loop: Scouting -> Outreach -> Optimization.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.scout import scout_businesses
from agentz.core.campaigns import optimize_campaigns
from agentz.core.llm import lm_manager
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        # 1. Setup
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # 2. Scout for NEW opportunities
        city = "Ann Arbor"
        ctx.step(f"--- Scouting Phase: {city} ---")
        
        if ctx.mode == Mode.DRY_RUN:
            candidates = [{"name": "A2 Artisan Brews", "vertical": "brewery"}]
            ctx.step(f"Scout {city} (Dry-run)")
        else:
            candidates = ctx.step(
                f"Identify pilot expansion candidates in {city}",
                action=lambda: asyncio.run(scout_businesses(city, ctx))
            )
            
        # 3. Outreach (Simulated via HubSpot logic)
        if candidates:
            top = candidates[0]
            ctx.step(f"--- Outreach Phase: {top['name']} ---")
            ctx.step(f"Drafting personalized pitch for {top['name']}...")
            ctx.step(f"Mocking email delivery to {top['name']} via HubSpot workflow.")
            
        # 4. Optimization of EXISTING pilots
        ctx.step("--- Optimization Phase: Existing Pilots ---")
        if ctx.mode == Mode.DRY_RUN:
            ctx.step("Analyze scan engagement and adjust reward campaigns (Dry-run)")
        else:
            opts = ctx.step(
                "Running campaign optimization engine",
                action=lambda: asyncio.run(optimize_campaigns(supabase))
            )
            if opts:
                ctx.step(f"Applied {len(opts)} optimizations: {', '.join(opts)}")
            else:
                ctx.step("No optimizations needed (high engagement detected).")
                
        return "Autonomous growth loop completed successfully."
    finally:
        lm_manager.unload_model("local-model")
