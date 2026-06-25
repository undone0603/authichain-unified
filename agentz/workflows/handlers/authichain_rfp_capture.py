"""
agentz.workflows.handlers.authichain_rfp_capture
----------------------------------------------
Phase 6: Autonomous Federal RFP Capture.
Loads qualified opportunities from the pursue list, drafts a proposal
for each one not yet in the ledger, and records 'drafted' status.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.grants import draft_federal_proposal, save_proposal
from agentz.core.grants_pipeline import qualified_opportunities, status_of, update_status
from agentz.core.llm import lm_manager


def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        ctx.step("🎖️ --- INITIALIZING FEDERAL RFP CAPTURE MACHINE --- 🎖️")

        ctx.step("Loading qualified opportunities from pursue list...")
        opportunities = qualified_opportunities()
        if not opportunities:
            return "No qualified federal opportunities (fit_score >= 80, future deadline)."

        ctx.step(f"Found {len(opportunities)} qualified opportunities.")

        drafted = 0
        skipped = 0
        for opp in opportunities:
            notice_id = opp["notice_id"]
            existing = status_of(notice_id)
            if existing is not None:
                ctx.step(f"  ↪ Skipping {notice_id} ({opp['title']}): already '{existing}'")
                skipped += 1
                continue

            ctx.step(f"Drafting Phase 1 response for: {opp['title']} ({opp['agency']})")

            if ctx.mode == Mode.DRY_RUN:
                # No LLM call, no ledger write - describe only.
                continue

            content = ctx.step(
                f"LLM draft for {notice_id}",
                action=lambda o=opp: asyncio.run(draft_federal_proposal(o)),
            )
            if content is None:
                continue

            filename = f"federal_proposal_{notice_id}"
            path = save_proposal(filename, content)
            update_status(
                notice_id,
                "drafted",
                title=opp.get("title", ""),
                agency=opp.get("agency", ""),
                deadline=opp.get("deadline", ""),
                fit_score=opp.get("fit_score", 0),
                artifact_path=path,
            )
            ctx.step(f"  ✓ Saved {path}")
            drafted += 1

        return (
            f"Federal Capture complete: {drafted} drafted, {skipped} already in pipeline, "
            f"{len(opportunities)} qualified total."
        )
    finally:
        lm_manager.unload_model("local-model")
