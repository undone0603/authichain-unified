"""
agentz.workflows.handlers.content_multiplier
-------------------------------------------
Workflow handler for programmatic content multiplication.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext
from agentz.core.multiplier import multiply_content, archive_multiplied_assets

def run(ctx: ExecutionContext) -> Optional[str]:
    # Simulation: In production, fetch from Supabase
    pilots = [
        {"brand": "Detroit Artisan Brews", "name": "MI Heritage Ale", "metadata": {"origin": "Michigan", "year": "2026"}},
        {"brand": "Hermes International", "name": "Birkin 30", "metadata": {"material": "Leather", "status": "Hardened"}},
        {"brand": "Pfizer Inc.", "name": "BioNTech Batch #72", "metadata": {"compliance": "DSCSA", "site": "Global"}}
    ]
    
    ctx.step(f"--- CONTENT MULTIPLICATION BLITZ ({len(pilots)} pilots) ---")
    
    generated = 0
    for p in pilots:
        ctx.step(f"Multiplying content for {p['brand']} - {p['name']}...")
        
        # 1. Generate Assets
        assets = ctx.step(
            f"Generate Blog/Social/Thread for {p['brand']}",
            action=lambda p=p: asyncio.run(multiply_content(p))
        )
        
        # 2. Archive Assets
        path = ctx.step(
            f"Archive assets to agentz/logs/marketing",
            action=lambda p=p, a=assets: asyncio.run(archive_multiplied_assets(p['brand'], p['name'], a))
        )
        
        ctx.step(f"✓ Assets saved to {path}")
        generated += 1
        
    return f"Content multiplication complete. Generated assets for {generated} pilots."
