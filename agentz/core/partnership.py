"""
agentz.core.partnership
----------------------
Partnership Agent: Autonomously identifies and engages logistics and
insurance providers for strategic trust alliances.
"""
from __future__ import annotations
import json
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
        "Find their B2B partnership or digital transformation contact pages. "
        "Extract a list of leads including their name, type (Logistics or Insurance), "
        "and lead_url. Return the data as a clean JSON list of objects."
    )

    llm = get_llm(model="gpt-4o")
    agent = Agent(task=task, llm=llm, controller=controller)

    if not ctx:
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)

    # Extract JSON from the real search result -- never fall back to
    # canned leads naming real companies.
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
            raise ValueError("Expected a JSON list of leads")
        return results
    except Exception as e:
        logger.error(f"Partnership scout: failed to parse results: {e}. Raw content: {last_content[:100]}...")
        return []

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
