"""
agentz.workflows.handlers.authichain_partner_outreach
----------------------------------------------------
Autonomous Outreach for the AuthiChain Partnership & Referral Program.
Now powered by the WorkflowEngine for stateful, resumable execution.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext
from agentz.core.social import generate_social_post
from agentz.core.llm import lm_manager
from agentz.core.workflow_engine import WorkflowEngine

def run(ctx: ExecutionContext) -> Optional[str]:
    # 1. Initialize Engine
    # We can pass a run_id to resume, or let it generate a new one
    run_id = ctx.parameters.get("run_id") 
    params = {
        "targets": ctx.parameters.get("targets", [
            {"brand": "VeChain", "type": "Infrastructure", "focus": "Sustainability/ESG"},
            {"brand": "Polygon", "type": "Infrastructure", "focus": "Enterprise Adoption"},
            {"brand": "Privado ID", "type": "Identity", "focus": "ZKP/Privacy"},
            {"brand": "3327.io", "type": "Collective", "focus": "Web3 R&D"}
        ])
    }
    
    engine = WorkflowEngine(
        workflow_id="authichain_partner_outreach", 
        run_id=run_id, 
        parameters=params
    )

    lm_manager.load_model("local-model")
    try:
        ctx.step(f"--- STARTING PARTNERSHIP OUTREACH (Run: {engine.run_id}) ---")
        
        partners = engine.parameters["targets"]
        ctx.step(f"Targeting {len(partners)} high-leverage partners.")
        
        activated = 0
        for p in partners:
            brand = p["brand"]
            step_id = f"outreach_{brand.lower().replace(' ', '_')}"
            
            # Use the engine to ensure we don't re-send the same invitation if resumed
            def perform_outreach(brand_name=brand, focus=p["focus"]):
                ctx.step(f"Activating Partnership Lead: {brand_name}...")
                topic = f"Strategic alliance with AuthiChain. Integrating our Autonomous Trust Infrastructure with {brand_name}'s {focus} stack."
                
                invitation = asyncio.run(generate_social_post(topic, "Technical Partnership Invitation"))
                offer_addendum = (
                    f"\n\n--- FOUNDING PARTNER OFFER ---\n"
                    f"Incentive: 20% setup fee share ($500/deal) + 3% share of founder income distributions for the first year."
                )
                final_message = invitation + offer_addendum
                
                from agentz.core.outreach import add_pending_dm
                add_pending_dm(brand_name, final_message, "https://authichain.com/partners")
                return f"✓ Proposal queued for {brand_name}."

            try:
                result = engine.execute_step(step_id, perform_outreach)
                ctx.step(result)
                activated += 1
            except Exception as e:
                ctx.step(f"Outreach failed for {brand}: {e}")
                continue
                
        engine.complete()
        return f"Partnership Blitz complete. {activated} high-leverage proposals processed."
    finally:
        lm_manager.unload_model("local-model")
