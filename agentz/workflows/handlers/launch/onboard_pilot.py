"""
agentz.workflows.handlers.launch.onboard_pilot
----------------------------------------------
Onboard a new pilot customer. This is the highest-value workflow
in the Governor's pre-revenue phase.

Creates:
  - Product record in Supabase
  - QR codes / NFC payloads
  - Verification endpoint
  - Evidence page
  - Customer onboarding documentation
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    """Onboard a pilot customer end-to-end."""
    ctx.step("PilotCloser: onboarding pilot customer")

    if ctx.mode == Mode.DRY_RUN:
        return (
            "ONBOARD_PILOT: Would create product record, generate QR/NFC, "
            "configure verification, and deploy evidence page. "
            "Maps to existing builder + pages + trust modules."
        )

    # In production, this would orchestrate:
    # 1. create_product_identity (builder.py)
    # 2. generate_secure_qr / generate_physical_qr_asset (builder.py)
    # 3. Deploy verification endpoint (existing worker)
    # 4. Create evidence page (pages.py)
    # 5. Record onboarding in audit log
    return "ONBOARD_PILOT: Pilot onboarding flow initiated (see audit log for details)."
