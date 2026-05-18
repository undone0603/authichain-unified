"""
agentz.core.research
--------------------
Research Agent: Uses browser-use to find real-time news and decision-makers
for ultra-personalized outreach.
"""
from __future__ import annotations
import json
import logging
from typing import Dict, Any, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.research")

async def research_lead_context(company_name: str, ctx: Optional[ExecutionContext] = None) -> Dict[str, Any]:
    """
    Uses browser-use to find latest news and key decision-makers for a company.
    """
    from browser_use import Agent, Controller
    from agentz.core.browser import attach_interceptor, run_with_healing
    
    controller = Controller()
    if ctx:
        attach_interceptor(controller, ctx)
        
    task = (
        f"Search for the latest 2026 news regarding {company_name}'s supply chain, "
        "sustainability initiatives, or brand protection. "
        f"Also, find the name and LinkedIn profile of their Chief Sustainability Officer, "
        "Head of Brand Protection, or Supply Chain Director. "
        "Return a JSON object with: 'latest_news' (string summary), "
        "'decision_maker_name', and 'decision_maker_role'."
    )
    
    # Use the Limit-Proof LLM for high-fidelity research
    llm = get_llm(model="gpt-4o") 
    agent = Agent(task=task, llm=llm, controller=controller)
    
    if not ctx:
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)
        
    if history is None:
        logger.error("Research failed: history is None")
        return {
            "latest_news": f"Leading innovation in {company_name}'s vertical.",
            "decision_maker_name": "Decision Maker",
            "decision_maker_role": "Executive"
        }

    last_content = history.final_result()
    logger.debug(f"Research final result: {last_content}")
    
    if last_content is None:
        logger.error("Research failed: last_content is None")
        return {
            "latest_news": f"Leading innovation in {company_name}'s vertical.",
            "decision_maker_name": "Decision Maker",
            "decision_maker_role": "Executive"
        }
    
    try:
        # Extract JSON from history
        if "```json" in last_content:
            last_content = last_content.split("```json")[1].split("```")[0].strip()
        elif "```" in last_content:
            last_content = last_content.split("```")[1].split("```")[0].strip()
            
        results = json.loads(last_content)
        if not results:
            raise ValueError("Empty JSON result")
        return results
    except Exception as e:
        logger.error(f"Research parsing failed: {e}. Raw: {str(last_content)[:100]}")
        return {
            "latest_news": f"Leading innovation in {company_name}'s vertical.",
            "decision_maker_name": "Decision Maker",
            "decision_maker_role": "Executive"
        }
