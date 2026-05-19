"""
agentz.workflows.handlers.govchain_proposal
-------------------------------------------
Picks the highest-fit unsubmitted grant from the shared pipeline and drafts a proposal.
"""
from __future__ import annotations
from pathlib import Path
from agentz.core.modes import ExecutionContext
from agentz.core.llm import get_llm
from agentz.core.grants_pipeline import qualified_opportunities, status_of, update_status

REPO_ROOT = Path(__file__).resolve().parents[3]
PROPOSALS_DIR = REPO_ROOT / "content" / "grants" / "govchain"


def run(ctx: ExecutionContext) -> str:
    ctx.step("Loading qualified grants from pursue list...")
    opportunities = qualified_opportunities()
    top = next((o for o in opportunities if status_of(o["notice_id"]) is None), None)
    if top is None:
        return "No unsubmitted qualified grants in pursue list."

    ctx.step(f"Drafting proposal for: {top['title']} (Score: {top['fit_score']})")

    prompt = f"""
    You are an expert grant writer for GovChain.us.
    Draft an SBIR/SVIP Phase 1 proposal for this opportunity:
    Title: {top['title']}
    Agency: {top['agency']}
    Notice ID: {top['notice_id']}

    GovChain is an autonomous engine for government compliance and auditing.
    Include Sections:
    1. Executive Summary
    2. Technical Approach
    3. Commercialization Strategy
    Output entirely in Markdown.
    """

    llm = get_llm(model="limit-proof", temperature=0.2)
    response = llm.invoke(prompt)

    PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
    draft_path = PROPOSALS_DIR / f"{top['notice_id']}.md"
    draft_path.write_text(response.content, encoding="utf-8")

    update_status(
        top["notice_id"],
        "drafted",
        title=top.get("title", ""),
        agency=top.get("agency", ""),
        deadline=top.get("deadline", ""),
        fit_score=top.get("fit_score", 0),
        artifact_path=str(draft_path),
    )

    ctx.step(f"Proposal saved to {draft_path}")
    return f"Drafted proposal for {top['notice_id']}"
