"""
agentz.core.legal
-----------------
Legal Agent: Autonomously monitors external marketplaces for IP infringement
and drafts legal enforcement notices (Cease & Desist / DMCA).
"""
from __future__ import annotations
import json
import logging
from typing import Dict, Any, List, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.legal")

async def scout_marketplace_infringement(brand_name: str, ctx: Optional[ExecutionContext] = None) -> List[Dict[str, str]]:
    """
    Uses browser-use to find unauthorized or counterfeit listings on eBay/Amazon.
    """
    from browser_use import Agent, Controller
    from agentz.core.browser import attach_interceptor, run_with_healing

    controller = Controller()
    if ctx:
        attach_interceptor(controller, ctx)

    task = (
        f"Search eBay and Amazon for listings of '{brand_name}' that appear to be counterfeit "
        "or unauthorized. Look for suspiciously low prices or non-branded sellers. "
        "Extract a list of listings including url, seller, and issue (why it looks "
        "infringing). Return the data as a clean JSON list of objects."
    )

    llm = get_llm(model="gpt-4o")
    agent = Agent(task=task, llm=llm, controller=controller)

    if not ctx:
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)

    # Extract JSON from the real search result -- a drafted Cease & Desist
    # must never be based on fabricated listings.
    last_content = history.final_result()
    if not last_content:
        return []
    try:
        if "```json" in last_content:
            last_content = last_content.split("```json")[1].split("```")[0].strip()
        elif "```" in last_content:
            last_content = last_content.split("```")[1].split("```")[0].strip()

        results = json.loads(last_content)
        if not isinstance(results, list):
            raise ValueError("Expected a JSON list of listings")
        return results
    except Exception as e:
        logger.error(f"Legal scout: failed to parse results: {e}. Raw content: {last_content[:100]}...")
        return []

async def draft_enforcement_notice(infringement_data: Dict[str, str], brand_name: str) -> str:
    """
    Autonomously drafts a professional Cease & Desist letter.
    """
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    You are the AuthiChain Legal AI. Draft a professional Cease & Desist letter to the seller: {infringement_data['seller']}.
    Brand: {brand_name}
    Violation: {infringement_data['issue']} at {infringement_data['url']}
    
    State that {brand_name} is protected by AuthiChain's blockchain-anchored authenticity protocol 
    and this listing is unauthorized. Demand immediate removal within 24 hours.
    
    Tone: Firm, legal, authoritative.
    """
    
    response = llm.invoke(prompt)
    return response.content.strip()
