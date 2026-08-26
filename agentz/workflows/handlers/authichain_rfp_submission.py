"""
agentz.workflows.handlers.authichain_rfp_submission
--------------------------------------------------
Phase 11: Autonomous RFP Submission Loop.
Scans the pipeline ledger for 'reviewed' proposals and submits them 
via the browser-use submission agent.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.grants_pipeline import read_ledger, update_status
from agentz.core.submission import submit_proposal_via_browser
from agentz.core.llm import lm_manager


def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        ctx.step("🎖️ --- INITIALIZING AUTONOMOUS RFP SUBMISSION LOOP --- 🎖️")

        ctx.step("Scanning pipeline ledger for 'reviewed' proposals...")
        ledger = read_ledger()
        targets = [
            {"notice_id": nid, **data} 
            for nid, data in ledger.items() 
            if data.get("status") == "reviewed"
        ]

        if not targets:
            return "No proposals currently in 'reviewed' status. Submission loop idle."

        ctx.step(f"Found {len(targets)} proposal(s) ready for submission.")

        submitted = 0
        failed = 0
        
        for target in targets:
            notice_id = target["notice_id"]
            artifact_path = target.get("artifact_path")
            
            if not artifact_path:
                ctx.step(f"  ⚠ Skipping {notice_id}: No artifact path found in ledger.")
                continue

            ctx.step(f"Submitting bid for Notice ID: {notice_id} ({target.get('title')})...")

            if ctx.mode == Mode.DRY_RUN:
                ctx.step(f"  [Dry-run] Would upload {artifact_path} to portal.")
                submitted += 1
                continue

            # In production, we'd use the real portal URL if known, else SAM.gov default
            result = ctx.step(
                f"Submit proposal for {notice_id}",
                action=lambda: asyncio.run(submit_proposal_via_browser(ctx, notice_id, artifact_path))
            )
            
            # Ensure we handle the unpacked tuple correctly
            if isinstance(result, tuple) and len(result) == 2:
                success, proof = result
            else:
                success, proof = result, "No proof provided"

            if success:
                update_status(notice_id, "submitted", submission_proof=proof)
                ctx.step(f"  ✓ Notice {notice_id} successfully transitioned to 'submitted'.")
                ctx.step(f"  -> Proof: {proof[:100]}...")
                submitted += 1
            else:
                ctx.step(f"  ✖ Notice {notice_id} submission failed: {proof}")
                failed += 1

        return f"RFP Submission Loop complete. {submitted} submitted, {failed} failed."
    finally:
        lm_manager.unload_model("local-model")
