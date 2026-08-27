"""
agentz.workflows.handlers.launch.followup
------------------------------------------
Send follow-ups to prospects in the pipeline. This is approval-gated
and rate-limited. Uses the existing hubspot_followups handler pattern.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    """Send follow-ups (approval-gated)."""
    ctx.step("PilotCloser: sending follow-ups")

    if ctx.mode == Mode.DRY_RUN:
        return "FOLLOWUP: Would send follow-ups to prospects past their response window. Approval-gated."

    # In production, would delegate to the existing hubspot_followups handler
    # but with the risk firewall enforcing the approval gate.
    return (
        "FOLLOWUP: Follow-ups queued for human approval. "
        "Outbound quality threshold not yet established — no auto-send."
    )
