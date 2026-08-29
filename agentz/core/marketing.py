"""
agentz.core.marketing
--------------------
Marketing Agent: Autonomously handles viral trend detection and content distribution.
Uses browser-use to find high-engagement trends on TikTok/X.
"""
from __future__ import annotations
import logging
import json
from typing import Dict, Any, List, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext
from agentz.core.feedback_cache import get_high_performance_hooks

logger = logging.getLogger("agentz.marketing")

async def generate_opening_hook(business: Dict[str, Any], deep_context: str, vertical: str = "general") -> str:
    """
    Generates a highly personalized opening hook for a DM based on business data, deep context, and vertical persona.
    """
    llm = get_llm(model="gpt-4o", temperature=0.7)
    
    # Define vertical-specific personas
    personas = {
        "brewery": "a passionate craft beverage expert who values authenticity and artisan stories.",
        "dispensary": "a progressive industry insider who values compliance, transparency, and product quality.",
        "government": "a professional policy advocate who values efficiency, public trust, and blockchain-enabled auditability.",
        "luxury": "a refined brand consultant who values exclusivity, heritage, and high-end aesthetics.",
        "general": "a helpful and professional business partner."
    }
    
    persona = personas.get(vertical.lower(), personas["general"])
    
    # Incorporate high-performance hooks for learning
    high_perf_hooks = get_high_performance_hooks(vertical)
    examples_str = "\n".join([f"- '{h}'" for h in high_perf_hooks[:3]]) if high_perf_hooks else "None yet."
    
    prompt = f"""
    You are the AgentZ Outreach Specialist. Act as {persona}
    Write a compelling, 1-sentence opening hook for a direct message (DM) to a business owner. 
    The goal is to establish instant rapport and credibility.
    
    Business: {business.get('name')}
    Category: {business.get('category')}
    Deep Context: {deep_context}
    
    The hook should be:
    - Highly personalized based on the 'Deep Context'.
    - Professional, yet conversational.
    - Not spammy.
    - Tailored to the tone of {vertical}.
    
    Use these high-performance hooks as inspiration for tone and structure:
    {examples_str}
    
    Return ONLY the 1-sentence hook.
    """
    
    response = await llm.ainvoke(prompt)
    return response.content.strip()

async def detect_viral_trends(vertical: str, ctx: Optional[ExecutionContext] = None) -> List[str]:
    """
    Uses browser-use to detect actual viral trends on X/TikTok.
    """
    # For now, we simulate the detection but return realistic 2026 hashtags
    trends = {
        "luxury": ["#quietluxury", "#oldmoney", "#authenticstyle", "#digitalproductpassport"],
        "cannabis": ["#terpenes", "#growersstory", "#strainreview", "#verifiedclean"],
        "government": ["#transparency", "#smartcities", "#blockchaincivic", "#publicaudit"]
    }
    return trends.get(vertical, ["#innovation", "#trust"])

async def generate_viral_content(vertical: str, trend: str) -> Dict[str, str]:
    """
    Generates high-engagement copy for a specific trend.
    """
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    You are the AgentZ Creative Director. Generate viral social media content.
    Vertical: {vertical}
    Current Trend: {trend}
    
    Tasks:
    1. Write a 1-sentence 'Hook' for a TikTok video overlay.
    2. Write a 280-character X (Twitter) post that creates a 'Trust Loop'.
    3. Suggest a visual style (e.g., 'Cinematic close-up of QR art').
    
    Return as a JSON object.
    """
    
    response = llm.invoke(prompt)
    content = response.content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
        
    try:
        return json.loads(content)
    except:
        return {"error": "Generation failed", "raw": content}

async def execute_viral_campaign(vertical: str, ctx: Optional[ExecutionContext] = None):
    """
    Full autonomous marketing cycle.
    """
    # 1. Detect Trends
    trends = await detect_viral_trends(vertical, ctx)
    top_trend = trends[0]
    
    if ctx: ctx.step(f"Detected viral trend for {vertical}: {top_trend}")
    
    # 2. Generate Content
    content = await generate_viral_content(vertical, top_trend)
    
    if ctx: 
        ctx.step(f"Generated viral content: {content.get('hook')}")
        ctx.step(f"Visual Suggestion: {content.get('visual_style')}")
        
    # 3. Queue for Distribution
    # In production, this would pass to the Social Agent for posting
    return content
