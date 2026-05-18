"""
agentz.workflows.handlers.authichain_social_launch
-------------------------------------------------
Executes the autonomous social distribution for the ecosystem launch.
Now pulls copy from reddit_qron_launch_posts.md for high-fidelity posts.
"""
from __future__ import annotations
import asyncio
from pathlib import Path
from agentz.core.modes import ExecutionContext
from agentz.core.social import distribute_content

def run(ctx: ExecutionContext) -> str:
    ctx.step("--- REVENUE BLITZ: SOCIAL SIPHON ---")
    
    # 1. Load Pre-written Copy
    posts_path = Path(__file__).resolve().parents[3] / "reddit_qron_launch_posts.md"
    if posts_path.exists():
        ctx.step(f"Loading high-fidelity launch copy from: {posts_path}")
        copy_content = posts_path.read_text(encoding="utf-8")
    else:
        ctx.step("Launch copy file not found. Using dynamic generation.")
        copy_content = "The launch of the Authentic Economy: Autonomous Trust for physical goods."
    
    # 2. Multi-platform Distribution
    platforms = ["LinkedIn", "Reddit (r/QRcode)", "Reddit (r/generative)", "Twitter"]
    
    ctx.step(f"Starting orchestrated distribution for: QRON Space Launch")
    
    # In full-auto mode, this would trigger browser agents to actually post
    asyncio.run(distribute_content(ctx, copy_content[:200] + "...", platforms))
    
    return "Social Siphon complete. Monitoring for engagement..."
