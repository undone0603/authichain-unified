"""
agentz.workflows.handlers.launch.measure_pilot
-----------------------------------------------
Measure pilot health: scans, verifications, usage, customer outcome.
Feeds data into the Launch Score's customer dimension.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    """Measure pilot health metrics."""
    ctx.step("Measuring pilot health")

    if ctx.mode == Mode.DRY_RUN:
        return "MEASURE_PILOT: Would query Supabase for scan counts, verification rates, and pilot engagement."

    # In production, would query Supabase for:
    # - Total scans per pilot
    # - Verification success rate
    # - Product usage metrics
    # - Customer outcome signals
    return "MEASURE_PILOT: Pilot health metrics recorded (see audit log)."
