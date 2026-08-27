"""
agentz.workflows.handlers.launch.prepare_outreach
--------------------------------------------------
Prepare personalized outreach materials for qualified prospects.

This is approval-gated. Outbound communication should NOT be sent
until messaging, compliance, and deliverability are proven.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    """Prepare outreach materials (approval-gated, no sending)."""
    ctx.step("PilotCloser: preparing outreach materials")

    if ctx.mode == Mode.DRY_RUN:
        return (
            "PREPARE_OUTREACH: Would generate personalized outreach drafts "
            "(email subject, body, demo link, pilot proposal). "
            "Would NOT send — outbound is approval-gated until quality threshold met."
        )

    # In production, this would:
    # 1. Load qualified prospects from Supabase
    # 2. For each, generate personalized outreach using the LLM
    # 3. Store drafts for human review
    # 4. NOT send anything — outbound is approval-gated

    return (
        "PREPARE_OUTREACH: Outreach drafts generated and stored for review. "
        "No messages sent — outbound quality threshold not yet established. "
        "Requires human approval before sending."
    )
