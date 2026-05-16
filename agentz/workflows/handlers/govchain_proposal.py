"""
agentz.workflows.handlers.govchain_proposal
-------------------------------------------
Reads gov_pursue_list.csv, finds top unsubmitted grant, and 
uses LLM to draft a proposal.
"""
import os
import csv
from datetime import datetime
from agentz.core.modes import ExecutionContext
from agentz.core.llm import get_llm

def run(ctx: ExecutionContext) -> str:
    ctx.step("Loading gov_pursue_list.csv")
    csv_path = os.path.join(os.path.dirname(__file__), "../../../gov_pursue_list.csv")
    
    if not os.path.exists(csv_path):
        return f"Error: {csv_path} not found"
        
    proposals_dir = os.path.join(os.path.dirname(__file__), "../../../content/grants/govchain")
    os.makedirs(proposals_dir, exist_ok=True)
    
    # Load submitted proposals to avoid duplicates
    submitted = set()
    for f in os.listdir(proposals_dir):
        if f.endswith(".md"):
            submitted.add(f.split(".")[0])
            
    # Find highest fit score unsubmitted
    top_grant = None
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        grants = list(reader)
        # sort by fit_score descending
        grants.sort(key=lambda x: int(x.get('fit_score', 0)), reverse=True)
        
        for g in grants:
            if g['notice_id'] not in submitted:
                top_grant = g
                break
                
    if not top_grant:
        return "No unsubmitted grants found in gov_pursue_list.csv"
        
    ctx.step(f"Drafting proposal for: {top_grant['title']} (Score: {top_grant['fit_score']})")
    
    prompt = f"""
    You are an expert grant writer for GovChain.us.
    Draft an SBIR/SVIP Phase 1 proposal for this opportunity:
    Title: {top_grant['title']}
    Agency: {top_grant['agency']}
    Notice ID: {top_grant['notice_id']}
    
    GovChain is an autonomous engine for government compliance and auditing.
    Include Sections:
    1. Executive Summary
    2. Technical Approach
    3. Commercialization Strategy
    Output entirely in Markdown.
    """
    
    llm = get_llm(model="limit-proof", temperature=0.2)
    response = llm.invoke(prompt)
    
    draft_path = os.path.join(proposals_dir, f"{top_grant['notice_id']}.md")
    with open(draft_path, "w", encoding="utf-8") as f:
        f.write(response.content)
        
    ctx.step(f"Proposal saved to {draft_path}")
    return f"Drafted proposal for {top_grant['notice_id']}"
