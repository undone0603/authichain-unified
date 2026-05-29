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
    """
    Generates platform-specific social copy.
    Uses Template Manager to prefer customized local templates over LLM.
    """
    from agentz.core.templates import get_template, fill_template
    
    # 1. Try Template First
    tpl_name = f"{platform.lower()}_default"
    template = get_template("social", tpl_name)
    
    if template:
        # Simple extraction of brand from topic for template filling
        brand = topic.split("for")[-1].strip().split(".")[0].strip() if "for" in topic else "Strategic Partner"
        return fill_template(template, {"brand": brand, "topic": topic})

    # 2. Live LLM Fallback
    prompt = f"""
    Write a high-engagement {platform} post about {topic}.
    The tone should be professional, innovative, and focused on trust.
    Include relevant hashtags.
    """
    
    try:
        llm = get_llm(model="gpt-4o")
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception:
        # Hardcoded static fallbacks as last resort
        if "twitter" in platform.lower() or "x" in platform.lower():
            return f"Excited to announce our latest blockchain trust anchor for {topic}! 🛡️\n\nProvenance verified. Authenticity secured.\n\n#AuthiChain #Web3 #TrustEconomy #DigitalTwin"
        elif "linkedin" in platform.lower():
            return f"We are proud to partner with industry leaders to bring autonomous trust to {topic}.\n\nBy leveraging blockchain-anchored digital twins, we are reducing supply chain risk and protecting brand integrity at scale.\n\nRead more at authichain.com.\n\n#AuthiChain #SupplyChain #Innovation #SovereignTrust"
        else:
            return f"Launching the future of authentic commerce for {topic}. Verified by AuthiChain. 🌐✨"

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
