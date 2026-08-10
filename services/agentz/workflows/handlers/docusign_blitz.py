"""
agentz.workflows.handlers.docusign_blitz
----------------------------------------
Workflow handler to dispatch high-value agreements for digital signature.

Recipient email must come from the agreement file itself (a
`recipient: someone@example.com` line in its YAML frontmatter). There
is no guessed/hardcoded mapping from filename to a real company's
email address -- a prior version of this file shipped with a fallback
table of real Hermes/LVMH/Pfizer contacts, which meant any agreement
file whose name happened to match would silently dispatch to them.
Agreements with no recipient in their frontmatter are skipped, not
sent to a guessed address.
"""
from __future__ import annotations
import asyncio
import glob
import re
from typing import Optional
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.docusign import create_envelope_from_markdown

RECIPIENT_RE = re.compile(r"^recipient:\s*(\S+)\s*$", re.MULTILINE)


def _extract_recipient(path: str) -> Optional[str]:
    with open(path, "r", encoding="utf-8") as f:
        head = f.read(2000)  # frontmatter lives at the top of the file
    match = RECIPIENT_RE.search(head)
    return match.group(1) if match else None


def run(ctx: ExecutionContext) -> Optional[str]:
    from agentz.core.credentials import get
    token = get("docusign_token", required=False)
    if not token:
        ctx.step("[!] docusign_token missing. Operating in SIMULATION MODE.")

    agreements = glob.glob("agentz/logs/agreements/*.md")
    if not agreements:
        return "No agreements found to dispatch."

    ctx.step(f"Found {len(agreements)} agreement(s) for the Signature Blitz.")

    sent_count = 0
    skipped_count = 0
    for path in agreements:
        target_email = _extract_recipient(path)
        if not target_email:
            ctx.step(f"Skipping {path} - no `recipient:` in frontmatter.")
            skipped_count += 1
            continue

        ctx.step(f"Dispatching signature request for {path} to {target_email}...")

        if ctx.mode != Mode.DRY_RUN:
            res = asyncio.run(create_envelope_from_markdown(path, target_email))
            ctx.step(f"Envelope Sent: {res['envelope_id']}")
            sent_count += 1

    return (
        f"Signature Blitz complete. {sent_count} agreement(s) dispatched, "
        f"{skipped_count} skipped (no recipient specified)."
    )
