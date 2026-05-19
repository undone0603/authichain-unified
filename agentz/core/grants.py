"""
agentz.core.grants
------------------
Grant Agent: Autonomously searches for and drafts SBIR/SVIP grant proposals.
Now hardened for high-fidelity federal RFP capture (Phase 16).
"""
from __future__ import annotations
import logging
import json
import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter

logger = logging.getLogger("agentz.grants")

async def scout_grant_opportunities(ctx: Optional[ExecutionContext] = None) -> List[Dict[str, Any]]:
    """Return qualified federal opportunities from the pursue list (fit_score >= 80, deadline in the future)."""
    import agentz.core.grants_pipeline as _gp
    return _gp.qualified_opportunities(_gp.DEFAULT_CSV)

async def draft_federal_proposal(grant_data: Dict[str, str]) -> str:
    """
    Autonomously drafts a high-fidelity Phase 1 SBIR proposal response.
    Uses a 3-step pipeline: Draft -> Critic -> Refine.
    """
    llm = get_llm(model="gpt-4o")
    
    # Official Company Metadata (Phase 20)
    company_meta = {
        "name": "AUTHICHAIN",
        "uei": "R34XKWRJY9A5",
        "cage": "1PUJ6",
        "address": "109 N 4th St, Roscommon, MI 48653-9090 USA",
        "purpose": "All Awards"
    }

    winning_narrative = (
        f"AUTHICHAIN (UEI: {company_meta['uei']}, CAGE: {company_meta['cage']}) provides an "
        "autonomous engine integrating blockchain (Polygon) and AI for proactive, "
        "immutable supply chain auditing. We shift from reactive manual auditing to "
        "real-time AI-driven enforcement and anomaly detection."
    )
    
    # 1. INITIAL DRAFT PASS
    initial_prompt = f"""
    You are the GovChain Lead Grant Writer. Draft a comprehensive Phase 1 SBIR Proposal Response.
    
    OFFICIAL APPLICANT:
    Name: {company_meta['name']}
    UEI: {company_meta['uei']}
    CAGE Code: {company_meta['cage']}
    Physical Address: {company_meta['address']}
    
    OPPORTUNITY:
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
    
    logger.info(f"Generating initial draft for {grant_data.get('notice_id')}...")
    initial_draft = llm.invoke(initial_prompt).content.strip()

    # 2. CRITIC PASS (Self-Correction)
    critic_prompt = f"""
    You are a Federal RFP Source Selection Evaluation Board (SSEB) Reviewer.
    Analyze the following draft proposal for technical compliance and depth.
    
    ORIGINAL RFP TITLE: {grant_data['title']}
    DRAFT PROPOSAL:
    {initial_draft}
    
    Identify 2-3 specific technical weaknesses, missing compliance items, or agency-alignment gaps.
    Return ONLY a bulleted list of deficiencies.
    """
    
    logger.info(f"Critic reviewing draft for {grant_data.get('notice_id')}...")
    deficiencies = llm.invoke(critic_prompt).content.strip()

    # 3. REFINEMENT PASS
    refine_prompt = f"""
    You are the GovChain Lead Grant Writer. Rewrite the following draft proposal to address the identified deficiencies.
    
    INITIAL DRAFT:
    {initial_draft}
    
    CRITIC FEEDBACK (Address these points explicitly):
    {deficiencies}
    
    Maintain the professional 15-page equivalent structure. 
    Ensure the final response is high-fidelity, technical, and directly addresses the Critic's concerns.
    Output entirely in Markdown.
    """
    
    logger.info(f"Refining proposal for {grant_data.get('notice_id')} based on feedback...")
    final_proposal = llm.invoke(refine_prompt).content.strip()
    
    return final_proposal

def save_proposal_pdf(filename: str, content: str) -> str:
    """Converts Markdown content to a professional PDF artifact."""
    grants_dir = Path(__file__).resolve().parent.parent / "logs" / "grants"
    grants_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    path = grants_dir / f"{filename}_{timestamp}.pdf"
    
    doc = SimpleDocTemplate(str(path), pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Simple Markdown-to-PDF: split by double newlines and wrap in Paragraphs
    sections = content.split("\n\n")
    for section in sections:
        clean = section.strip().replace("\n", "<br/>")
        if clean.startswith("# "):
            p = Paragraph(clean[2:], styles["Title"])
        elif clean.startswith("## "):
            p = Paragraph(clean[3:], styles["Heading2"])
        else:
            p = Paragraph(clean, styles["Normal"])
        story.append(p)
        story.append(Spacer(1, 12))
        
    doc.build(story)
    return str(path)

def save_proposal(filename: str, content: str, generate_pdf: bool = True) -> str:
    """Saves the drafted proposal to the logs/grants directory."""
    grants_dir = Path(__file__).resolve().parent.parent / "logs" / "grants"
    grants_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    md_path = grants_dir / f"{filename}_{timestamp}.md"
    
    with md_path.open("w", encoding="utf-8") as f:
        f.write(content)
        
    if generate_pdf:
        try:
            pdf_path = save_proposal_pdf(filename, content)
            logger.info(f"PDF Artifact generated: {pdf_path}")
            return pdf_path # Prefer PDF path for submission
        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}")
            
    return str(md_path)
