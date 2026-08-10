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
    Autonomously drafts a concise Phase 1 SBIR proposal response.
    Optimized for small context windows (2048 tokens).
    """
    llm = get_llm(model="gpt-4o") # Still uses the proxy which will fall back to local
    
    # Official Company Metadata
    company_meta = {
        "name": "AUTHICHAIN",
        "uei": "R34XKWRJY9A5",
        "cage": "1PUJ6",
    }

    prompt = f"""
    Draft a 500-word SBIR Proposal for:
    Title: {grant_data['title']}
    Agency: {grant_data['agency']}
    
    Company: {company_meta['name']} (CAGE: {company_meta['cage']})
    Tech: Blockchain-based supply chain audit, AI anomaly detection, W3C VCs.

    Draft using this structure:
    1. Summary: How we solve the agency problem.
    2. Approach: DLT + AI methodology.
    3. Impact: Federal security/integrity benefits.
    """
    
    logger.info(f"Generating concise draft for {grant_data.get('notice_id')}...")
    draft = llm.invoke(prompt).content.strip()
    return draft

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
