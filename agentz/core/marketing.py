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
from agentz.core.modes import ExecutionContext, Mode

logger = logging.getLogger("agentz.marketing")

async def detect_viral_trends(vertical: str, ctx: Optional[ExecutionContext] = None) -> List[str]:
    """
    Uses browser-use to detect actual viral trends on X/TikTok for a specific industry.
    """
    if ctx and ctx.mode == Mode.DRY_RUN:
        trends = {
            "luxury": ["#quietluxury", "#oldmoney", "#authenticstyle"],
            "cannabis": ["#terpenes", "#growersstory", "#strainreview"],
            "brewery": ["#craftculture", "#localhaze", "#brewmosaic"],
            "government": ["#transparency", "#smartcities", "#blockchaincivic"]
        }
        return trends.get(vertical, ["#innovation", "#trust"])

    try:
        from browser_use import Agent, Controller
        from agentz.core.browser import attach_interceptor, run_with_healing

        controller = Controller()
        if ctx:
            attach_interceptor(controller, ctx)

        task = (
            f"Search TikTok and X (Twitter) for the top 3 trending hashtags related to '{vertical}' and 'authenticity' "
            f"in May 2026. Focus on trends that value transparency or brand heritage. "
            "Return the hashtags as a JSON list."
        )

        llm = get_llm(model="gpt-4o") 
        agent = Agent(task=task, llm=llm, controller=controller)

        if not ctx:
            history = await agent.run()
        else:
            history = await run_with_healing(agent, ctx)

        last_content = history.final_result()
        if not last_content: raise ValueError("No trends found")

        if "[" in last_content:
            last_content = "[" + last_content.split("[")[1].split("]")[0] + "]"

        return json.loads(last_content)
    except Exception:
        return ["#innovation", "#verified", f"#{vertical}trends"]

async def generate_viral_content(business_data: Dict[str, Any], trend: str) -> Dict[str, str]:
    """
    Generates high-engagement copy for a specific trend, personalized to the brand.
    """
    name = business_data.get("name", "our partner")
    vertical = business_data.get("category", "luxury")
    deep_context = business_data.get("deep_context", "A premium brand focusing on quality.")

    llm = get_llm(model="gpt-4o")

    prompt = f"""
    You are the AgentZ Creative Director. Generate viral social media content for {name}.
    Vertical: {vertical}
    Current Viral Trend: {trend}
    Brand Context: {deep_context}

    Tasks:
    1. Write a 1-sentence 'Hook' for a TikTok video overlay. (Punchy, curiosity-driven)
    2. Write a 280-character X (Twitter) post that creates a 'Trust Loop'. Include the trend hashtag.
    3. Suggest a visual style (e.g., 'Macro lens reveal of the QRON security foil').

    Return as a JSON object with keys: "hook", "x_post", "visual_style".
    Return ONLY JSON.
    """

    response = llm.invoke(prompt)
    content = response.content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()

    try:
        return json.loads(content)
    except:
        return {
            "hook": f"The secret behind {name}'s authenticity.",
            "x_post": f"We just anchored {name} to the trust layer. Every scan is a signature of truth. {trend} #AuthiChain",
            "visual_style": "Cinematic reveal of physical asset."
        }


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
