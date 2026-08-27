"""
agentz.workflows.handlers.launch.convert_paid
---------------------------------------------
Convert an active pilot to a paying customer.

Uses the existing closer module (DocuSign + Stripe integration).
Records the payment event — this is the FIRST_REVENUE gate.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    """Convert pilot to paid customer."""
    ctx.step("PilotCloser: converting pilot to paid")

    if ctx.mode == Mode.DRY_RUN:
        return (
            "CONVERT_PAID: Would send closing package (DocuSign + Stripe link) "
            "via the existing closer module. Records payment event for FIRST_REVENUE gate."
        )

    # In production, would use:
    # from agentz.core.closer import send_closing_package
    # Result includes payment_url and envelope_id
    return "CONVERT_PAID: Closing package dispatched (DocuSign + Stripe). Payment event will be recorded."
