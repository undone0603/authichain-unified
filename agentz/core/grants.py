"""
agentz.core.grants
------------------
Grant Agent: Autonomously searches for and drafts SBIR/SVIP grant proposals.
Now hardened for high-fidelity federal RFP capture.
"""
from __future__ import annotations
import logging
import json
from typing import Any, Dict, List, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.grants")

async def scout_grant_opportunities(ctx: Optional[ExecutionContext] = None) -> List[Dict[str, Any]]:
    """Return qualified federal opportunities from the pursue list (fit_score >= 80, deadline in the future)."""
    import agentz.core.grants_pipeline as _gp
    return _gp.qualified_opportunities(_gp.DEFAULT_CSV)

async def draft_federal_proposal(grant_data: Dict[str, str]) -> str:
    """
    Autonomously drafts a high-fidelity Phase 1 SBIR proposal response.
    Synthesizes the specific RFP needs with the core AuthiChain/GovChain narrative.
    """
    llm = get_llm(model="gpt-4o")
    
    # Knowledge Base: Simplified reference to our winning 'THEMIS' narrative
    winning_narrative = (
        "AuthiChain's autonomous engine integrates blockchain (Polygon) and AI to provide "
        "proactive, real-time, and immutable supply chain auditing. We shift from reactive "
        "manual auditing to real-time AI-driven enforcement and anomaly detection."
    )
    
    prompt = f"""
    You are the GovChain Lead Grant Writer. Draft a comprehensive Phase 1 SBIR Proposal Response for the following federal opportunity:
    
    TITLE: {grant_data['title']}
    AGENCY: {grant_data['agency']}
    DEADLINE: {grant_data['deadline']}
    
    CORE TECHNOLOGY NARRATIVE:
    {winning_narrative}
    
    STRUCTURE:
    1. Executive Summary: Address the agency's operational risk and supply chain complexity.
    2. Technical Approach: Explain the integration of Blockchain (DLT), AI/ML Anomaly Detection, and Smart Contracts.
    3. Commercialization Strategy: Detail the transition from Phase 1 PoC to Phase 2 Pilot and Post-SBIR federal expansion.
    4. Competitive Advantage: Highlight our 'Autonomous & Proactive' methodology over traditional systems.
    
    Output a professional, 15-page structure equivalent (summarized in high-density Markdown).
    """
    
    response = llm.invoke(prompt)
    return response.content.strip()

def save_proposal(filename: str, content: str) -> str:
    """Saves the drafted proposal to the logs/grants directory."""
    from pathlib import Path
    import datetime
    
    grants_dir = Path(__file__).resolve().parent.parent / "logs" / "grants"
    grants_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    path = grants_dir / f"{filename}_{timestamp}.md"
    
    with path.open("w", encoding="utf-8") as f:
        f.write(content)
        
    return str(path)
