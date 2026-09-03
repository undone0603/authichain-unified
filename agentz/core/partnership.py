"""
agentz.core.partnership
----------------------
Partnership Agent: Autonomously identifies and engages logistics and 
insurance providers for strategic trust alliances.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.partnership")

async def scout_strategic_partners(vertical: str, ctx: Optional[ExecutionContext] = None) -> List[Dict[str, str]]:
    """
    Uses browser-use to find high-value logistics/insurance partners.
    """
    from browser_use import Agent, Controller
    from agentz.core.browser import attach_interceptor, run_with_healing
    
    controller = Controller()
    if ctx:
        attach_interceptor(controller, ctx)
        
    task = (
        f"Search for logistics providers (e.g., DHL, FedEx, UPS) and insurance firms "
        f"specializing in {vertical} (e.g., luxury, high-value electronics, pharmaceuticals). "
        "Find their B2B partnership or digital transformation contact pages."
    )
    
    llm = get_llm(model="gpt-4o")
    agent = Agent(task=task, llm=llm, controller=controller)
    
    if not ctx:
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)

    return _parse_leads(history)


def _parse_leads(history: Any) -> List[Dict[str, str]]:
    """
    Extract the agent's leads from its run history.

    Returns [] when there is no parseable result. Never substitutes
    placeholder leads: downstream code drafts real outreach to whatever
    this returns, so an invented lead becomes a real email to a real company.
    """
    import json

    try:
        raw = history.final_result()
    except Exception:
        logger.warning("Partner scout: no final_result on history; returning no leads.")
        return []

    if not raw:
        logger.warning("Partner scout: agent returned an empty result; returning no leads.")
        return []

    try:
        leads = json.loads(raw)
    except (TypeError, ValueError):
        logger.warning(
            "Partner scout: could not parse agent result as JSON; returning no leads. "
            "Raw result: %.200s", raw
        )
        return []

    if not isinstance(leads, list):
        logger.warning("Partner scout: agent result was not a list; returning no leads.")
        return []

    return leads

async def draft_partnership_proposal(partner_data: Dict[str, str], brand_metrics: Dict[str, Any]) -> str:
    """
    Autonomously drafts a 'Data-for-Trust' partnership invitation.
    """
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    You are the AuthiChain Strategic Alliances Lead. Draft a partnership invitation to {partner_data['name']}.
    Target: {partner_data['type']} partnership.
    Our Traction: {brand_metrics.get('scans')} scans verified, 0% breach rate.
    
    Proposal: We provide high-fidelity provenance data (anchored to Polygon) to reduce your underwriting risk.
    You provide real-time logistics feeds (Oracle integration) to our digital twins.
    
    Tone: Strategic, high-level, mutually beneficial.
    """
    
    response = llm.invoke(prompt)
    return response.content.strip()
