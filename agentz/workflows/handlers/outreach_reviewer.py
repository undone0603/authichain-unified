"""
agentz.workflows.handlers.outreach_reviewer
-------------------------------------------
Workflow handler for reviewing and approving pending outreach DMs.

Sending a DM always requires an explicit human "y" at an interactive
prompt (Mode.CONFIRM). It is never auto-approved in Mode.AUTO or
Mode.DRY_RUN -- this handler's entire purpose is to be a human review
gate before any message reaches a real contact, so it must not have a
path that bypasses that gate when run unattended.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.outreach import get_pending_dms, save_pending_dms, post_dm


def run(ctx: ExecutionContext) -> Optional[str]:
    dms = get_pending_dms()
    if not dms:
        return "No pending DMs to review."

    pending = [d for d in dms if d["status"] == "pending"]
    ctx.step(f"Loaded {len(pending)} pending DM(s) for review.")

    if ctx.mode != Mode.CONFIRM:
        for dm in pending:
            ctx.step(f"[review needed] {dm['lead_name']}: {dm['message'][:60]}...")
        return (
            f"{len(pending)} DM(s) awaiting human review. "
            "Run interactively (mode=confirm) to approve/reject."
        )

    approved_count = 0
    for dm in pending:
        print(f"\n--- DM REVIEW for {dm['lead_name']} ---")
        print(f"Target: {dm['lead_name']}")
        print(f"Message: {dm['message']}")
        print(f"Link: {dm['microsite_url']}")

        choice = input("\nApprove and Send? (y/n/skip): ").lower()

        if choice == "y":
            ctx.step(f"Posting DM to {dm['lead_name']}...")
            asyncio.run(post_dm(dm["lead_name"], dm["message"]))
            dm["status"] = "sent"
            approved_count += 1
        elif choice == "n":
            dm["status"] = "rejected"

    save_pending_dms(dms)
    return f"Review session complete. Sent {approved_count} DM(s)."
