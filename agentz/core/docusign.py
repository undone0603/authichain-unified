"""
agentz.core.docusign
--------------------
Manages DocuSign template ingestion and envelope dispatch for AgentZ.
"""
from __future__ import annotations
import logging
import httpx
from typing import Dict, Any, List
from agentz.core.credentials import get

logger = logging.getLogger("agentz.docusign")

async def create_envelope_from_markdown(agreement_path: str, contact_email: str) -> Dict[str, Any]:
    """
    Attempts to send a DocuSign envelope from a generated Markdown agreement.

    The real DocuSign API call is not yet implemented. Rather than reporting a
    fabricated success, this returns a status describing what actually
    happened: "simulated" (no token configured), "not_implemented" (token
    present but no real call), or "error". Callers must check `sent` before
    claiming an agreement was dispatched.
    """
    from pathlib import Path
    path = Path(agreement_path)
    if not path.exists():
        logger.error(f"Agreement not found: {agreement_path}")
        return {"status": "error", "message": "File not found"}

    content = path.read_text(encoding="utf-8")
    logger.info(f"Preparing DocuSign envelope for {contact_email} (Length: {len(content)} chars)")
    
    # 1. Call DocuSign API (not yet implemented -- see below)
    token = get("docusign_token", required=False)
    if not token:
        logger.warning("Missing docusign_token. Operating in Simulation Mode.")
        return {
            "envelope_id": f"sim_7992228b_{path.stem}",
            "status": "simulated",
            "mode": "simulation",
            "sent": False,
            "message": "No docusign_token configured; nothing was transmitted.",
            "recipient": contact_email
        }

    # A token is configured, but the real DocuSign call below is still a
    # placeholder -- nothing is actually transmitted, so this must not
    # claim "sent" either.
    # headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # payload = { "emailSubject": "Partnership Agreement - AuthiChain", ... }
    # r = await httpx.post(f"{BASE_URL}/envelopes", headers=headers, json=payload)
    logger.error(
        "docusign_token is set but create_envelope_from_markdown has no real "
        "API call implemented -- refusing to report the envelope as sent."
    )
    return {
        "envelope_id": None,
        "status": "not_implemented",
        "sent": False,
        "message": "DocuSign API call is not implemented; no envelope was created.",
        "recipient": contact_email
    }


async def check_envelope_status(envelope_id: str) -> str:
    """Queries DocuSign for the status of an envelope."""
    if not envelope_id:
        return "unknown"
    if envelope_id.startswith("sim_"):
        # Simulated envelopes were never transmitted, so they can never
        # legitimately be "completed" -- previously this auto-completed them,
        # which made downstream agents believe an agreement had been signed.
        return "simulated"
    return "unknown"
