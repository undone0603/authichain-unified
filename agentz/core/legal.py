"""
agentz.core.legal
-----------------
Legal Agent: Autonomously monitors external marketplaces for IP infringement
and drafts legal enforcement notices (Cease & Desist / DMCA).
"""
from __future__ import annotations
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
        "Extract a list of listing URLs and seller names."
    )
    
    llm = get_llm(model="gpt-4o")
    agent = Agent(task=task, llm=llm, controller=controller)
    
    if not ctx:
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)

    return _parse_infringements(history)


def _parse_infringements(history: Any) -> List[Dict[str, str]]:
    """
    Extract the agent's infringement findings from its run history.

    Returns [] when there is no parseable result. Never substitutes
    placeholder findings: draft_enforcement_notice turns these into Cease &
    Desist letters naming a specific seller, so a fabricated finding becomes
    a real legal threat against someone on no evidence.
    """
    import json

    try:
        raw = history.final_result()
    except Exception:
        logger.warning("Infringement scout: no final_result on history; returning no findings.")
        return []

    if not raw:
        logger.warning("Infringement scout: agent returned an empty result; returning no findings.")
        return []

    try:
        findings = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning(
            "Infringement scout: could not parse agent result as JSON; returning no "
            "findings. Raw result: %.200s", raw
        )
        return []

    if not isinstance(findings, list):
        logger.warning("Infringement scout: agent result was not a list; returning no findings.")
        return []

    return findings

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
