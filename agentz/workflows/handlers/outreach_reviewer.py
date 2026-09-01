"""
agentz.workflows.handlers.outreach_reviewer
-------------------------------------------
Workflow handler for reviewing and approving pending outreach DMs.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.outreach import get_pending_dms, save_pending_dms, post_dm

def run(ctx: ExecutionContext) -> Optional[str]:
    dms = get_pending_dms()
    if not dms:
        # Seed some data if empty for demonstration
        from agentz.core.outreach import add_pending_dm
        add_pending_dm(
            "LVMH",
            personalized_hook="Exciting news! Your digital twin is ready.",
            generic_hook="Protect luxury authenticity with cryptographic provenance.",
            message="Exciting news! Your digital twin is ready.",
            microsite_url="https://lvmh.authichain.com",
        )
        add_pending_dm(
            "Nike",
            personalized_hook="Protect your brand with blockchain trust.",
            generic_hook="Industry-standard trust verification for supply chains.",
            message="Protect your brand with blockchain trust.",
            microsite_url="https://nike.authichain.com",
        )
        dms = get_pending_dms()

    ctx.step(f"Loaded {len(dms)} pending DM(s) for review.")
    
    approved_count = 0
    for dm in dms:
        if dm['status'] != 'pending':
            continue
            
        print(f"\n--- DM REVIEW for {dm['lead_name']} ---")
        print(f"Target: {dm['lead_name']}")
        print(f"Message: {dm['message']}")
        print(f"Link: {dm['microsite_url']}")
        
        # In 'auto' mode, we simulate approval or use the first few
        if ctx.mode == Mode.AUTO:
            choice = "y"
            print("Auto-approving (mode=auto)...")
        else:
            choice = input("\nApprove and Send? (y/n/skip): ").lower()
        
        if choice == 'y':
            ctx.step(f"Posting DM to {dm['lead_name']}...")
            if ctx.mode != Mode.DRY_RUN:
                asyncio.run(post_dm(dm['lead_name'], dm['message']))
                dm['status'] = 'sent'
            approved_count += 1
        elif choice == 'n':
            dm['status'] = 'rejected'
        
    save_pending_dms(dms)
    return f"Review session complete. Sent {approved_count} DM(s)."
