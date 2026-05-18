"""
agentz.workflows.handlers.docusign_blitz
----------------------------------------
Workflow handler to dispatch high-value agreements for digital signature.
"""
from __future__ import annotations
import asyncio
import glob
from typing import Optional
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.docusign import create_envelope_from_markdown

def run(ctx: ExecutionContext) -> Optional[str]:
    # 1. Check for token, but allow simulation if missing
    token = get("docusign_token", required=False)
    if not token:
        ctx.step("⚠️ docusign_token missing. Operating in SIMULATION MODE.")

    ctx.step("Scanning for high-value agreements in logs/agreements...")
    agreements = glob.glob("agentz/logs/agreements/*.md")
    
    if not agreements:
        return "No agreements found to dispatch."
        
    ctx.step(f"Found {len(agreements)} agreement(s) for the Signature Blitz.")
    
    # Mock recipients for the blitz
    recipients = {
        "hermes": "legal@hermes.com",
        "lvmh": "partnerships@lvmh.com",
        "pfizer": "procurement@pfizer.com"
    }
    
    sent_count = 0
    for path in agreements:
        brand = path.lower()
        target_email = "admin@authichain.com" # Default fallback
        
        for k, v in recipients.items():
            if k in brand:
                target_email = v
                break
                
        ctx.step(f"Dispatching signature request for {brand} to {target_email}...")
        
        if ctx.mode != Mode.DRY_RUN:
            res = asyncio.run(create_envelope_from_markdown(path, target_email))
            ctx.step(f"Envelope Sent: {res['envelope_id']}")
            sent_count += 1
            
    return f"Signature Blitz complete. {sent_count} agreement(s) dispatched to DocuSign."
