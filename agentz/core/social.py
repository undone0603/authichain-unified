"""
agentz.core.social
------------------
Social Agent: Manages autonomous content distribution across 
Reddit, LinkedIn, and Twitter.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.social")

async def generate_social_post(topic: str, platform: str) -> str:
    """Generates platform-specific social copy."""
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    Write a high-engagement {platform} post about {topic}.
    The tone should be professional, innovative, and focused on trust.
    Include relevant hashtags.
    """
    
    response = llm.invoke(prompt)
    return response.content.strip()

async def distribute_content(ctx: ExecutionContext, topic: str, platforms: List[str]):
    """
    Coordinates multi-platform distribution.
    """
    for platform in platforms:
        copy = await generate_social_post(topic, platform)
        ctx.step(f"Post to {platform}: {copy[:50]}...")
        
        # Real-world integration would call Reddit/LinkedIn APIs or use browser-use
        # For this turn, we mock the final delivery step
        print(f"  [social] DISTRIBUTED to {platform}")
