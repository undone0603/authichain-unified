"""
agentz.workflows.handlers.govchain_proposal
-------------------------------------------
Picks the highest-fit unsubmitted grant from the shared pipeline and drafts a proposal.

Prefers local ChatOllama (llama3.2 / $OLLAMA_MODEL) so a dry-run needs no
paid API key. Dry-run still writes the markdown draft locally and skips
the pipeline ledger.
"""
from __future__ import annotations

import os
from pathlib import Path

from agentz.core.grants_pipeline import qualified_opportunities, status_of, update_status
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext, Mode

REPO_ROOT = Path(__file__).resolve().parents[3]
PROPOSALS_DIR = REPO_ROOT / "content" / "grants" / "govchain"


def _proposal_model() -> str:
    return os.environ.get("OLLAMA_MODEL") or os.environ.get("LLM_MODEL") or "llama3.2"


def _draft_llm():
    """Prefer ChatOllama on $OLLAMA_HOST; fall back to get_llm (same route)."""
    model = _proposal_model()
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    try:
        from langchain_ollama import ChatOllama
        return ChatOllama(model=model, temperature=0.2, base_url=host)
    except ImportError:
        return get_llm(model=model, temperature=0.2, base_url=host)


def run(ctx: ExecutionContext) -> str:
    ctx.step("Loading qualified grants from pursue list...")
    opportunities = qualified_opportunities()

    unsubmitted = [o for o in opportunities if status_of(o["notice_id"]) is None]
    unsubmitted.sort(key=lambda o: o.get("fit_score", 0), reverse=True)
    top = unsubmitted[0] if unsubmitted else None

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

    llm = _draft_llm()
    response = llm.invoke(prompt)
    content = getattr(response, "content", None)

    if not content or not str(content).strip():
        raise RuntimeError("LLM returned empty proposal content")

    PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
    draft_path = PROPOSALS_DIR / f"{top['notice_id']}.md"
    draft_path.write_text(str(content), encoding="utf-8")

    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"dry-run: draft saved locally at {draft_path}; skipping ledger update")
        return f"dry-run: drafted proposal for {top['notice_id']} (ledger not updated)"

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
