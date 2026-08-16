"""
agentz.core.reports
------------------
Autonomous Reporting Agent: Generates executive-ready documents, 
proposals, and ROI analysis (Manus-style).
"""
from __future__ import annotations
import datetime
from typing import Dict, Any, List
from agentz.core.llm import get_llm

async def generate_municipal_proposal(municipality: str, projects: List[Dict[str, Any]]) -> str:
    """
    Generates a professional markdown proposal for GovChain transparency pilots.
    """
    llm = get_llm(model="gpt-4o")
    
    project_summary = "\n".join([f"- {p['name']} (Budget: {p.get('budget', 'TBD')})" for p in projects])
    
    prompt = f"""
    You are the GovChain Municipal Coordinator. Write a professional 1-page proposal for {municipality}.
    Goal: Implement GovChain transparency layer for the following projects:
    {project_summary}
    
    Include:
    1. Executive Summary: Why transparency builds civic trust.
    2. Implementation Plan: How AgentZ autonomously anchors logs to Polygon.
    3. ROI: Reduced audit costs and increased public engagement.
    4. Call to Action: Initialize pilot.
    
    Output in clean Markdown.
    """
    
    response = llm.invoke(prompt)
    return response.content.strip()

async def generate_merchant_roi_report(brand: str, metrics: Dict[str, Any]) -> str:
    """
    Generates an ROI report for AuthiChain merchants based on scan data.
    """
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    You are the AuthiChain Growth Lead. Generate an ROI Report for {brand}.
    Current Metrics:
    - Total Authenticity Scans: {metrics.get('scans', 0)}
    - QRON Rewards Issued: {metrics.get('rewards', 0)}
    - Repeat Customer Rate: {metrics.get('retention', '15%')} (projected)
    
    Focus on:
    1. Brand Protection: Number of "Review Required" scans prevented.
    2. Emotional Engagement: StoryMode completion rates.
    3. Economic Impact: Loyalty loops via QRON.
    
    Output in clean Markdown.
    """
    
    response = llm.invoke(prompt)
    return response.content.strip()

async def generate_scale_up_report(ecosystem_data: Dict[str, Any]) -> str:
    """Generates a high-fidelity summary of the global infrastructure launch."""
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    You are the AgentZ Chief Strategy Officer. Generate a 'Global Scale-Up Report' for stakeholders.
    
    Current State:
    - Infrastructure: FastAPI REST Gateway (OpenAPI Live)
    - Consumer: Android/iOS Apps + qron.space Hub
    - Growth: Pi Network Studio (55M users) + Viral Marketing Agent
    - Trust: Polygon On-chain Anchoring + Dynamic Timelines
    
    Pipeline Statistics:
    - Total Deals in Pipeline: {ecosystem_data.get('deal_count', 0)}
    - Estimated Pipeline Value: ${ecosystem_data.get('pipeline_value', 0):,.2f}
    
    Include:
    1. Executive Summary: The transition from pilot to global infrastructure.
    2. Technical Achievement: API-first sovereignty and GPT integration.
    3. Market Reach: Tapping into the Pi Network and viral social loops.
    4. Strategic Outlook: Projected revenue from Layer 1 (SaaS) and Layer 2 (Burn Fees).
    
    Output in professional Markdown.
    """
    try:
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception as e:
        return f"# Scale-Up Report (Fallback)\nInfrastructure is live. Pi Network integrated. API online. Error generating AI summary: {e}"

async def generate_investor_deck_blueprint(city_ecosystem: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates a structured JSON blueprint for an investor pitch deck
    based on live pilot data and growth projections.
    """
    llm = get_llm(model="gpt-4o")
    
    prompt = f"""
    You are a Venture Capital Analyst and the AgentZ Chief of Staff.
    Generate a 10-slide Pitch Deck Blueprint for the {city_ecosystem.get('city')} Authentic Economy.
    
    Data Context:
    - Vertical 1 (AuthiChain): {city_ecosystem.get('authichain_stats')}
    - Vertical 2 (GovChain): {city_ecosystem.get('govchain_stats')}
    - Vertical 3 (StrainChain): {city_ecosystem.get('strainchain_stats')}
    
    Format the output as a JSON object with keys for each slide (1-10).
    Each slide should have: "Title", "KeyPoints" (list), and "VisualSuggestion".
    
    Slides should cover: Problem, Solution (AgentZ), Market Opportunity, Traction (Pilot Data),
    Business Model (Stripe SaaS), The QRON Economy, Expansion Plan, Team, The Moat (Blockchain Anchoring), and Ask.
    """
    
    import json
    response = llm.invoke(prompt)
    content = response.content.strip()
    
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
        
    try:
        return json.loads(content)
    except:
        return {"error": "Failed to parse deck blueprint", "raw": content}

def save_report(filename: str, content: str) -> str:
    """Saves a generated report to the logs/reports directory."""
    from pathlib import Path
    reports_dir = Path(__file__).resolve().parent.parent / "logs" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    path = reports_dir / f"{filename}_{timestamp}.md"
    
    with path.open("w", encoding="utf-8") as f:
        f.write(content)
        
    return str(path)

def save_json_report(filename: str, data: Dict[str, Any]) -> str:
    """Saves a JSON report to the logs/reports directory."""
    import json
    from pathlib import Path
    reports_dir = Path(__file__).resolve().parent.parent / "logs" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    path = reports_dir / f"{filename}_{timestamp}.json"
    
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    return str(path)
