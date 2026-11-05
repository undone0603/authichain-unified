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
        f"Search public eBay and Amazon listings mentioning '{brand_name}' for "
        "possible brand-protection review leads. Record exact public evidence "
        "and note uncertainty. Low prices, reseller status and listing text "
        "alone do NOT prove a counterfeit or unauthorized sale. "
        "Return listing URLs and seller names only as unverified scout reports."
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
    Backward-compatible name with fail-closed behavior.

    Previously generated a legal demand from an unverified search result.
    Now returns only a neutral INTERNAL review memo, not an enforcement
    claim, LLM-generated notice, or outbound message. An actual legal
    demand requires separately verified rights and counsel authorization.
    """
    from agentz.core.legal_case_review import build_internal_review_memo

    return build_internal_review_memo(infringement_data, brand_name)
