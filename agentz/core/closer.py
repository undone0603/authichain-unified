"""
agentz.core.closer
------------------
Closer Agent: Monitors HubSpot leads and autonomously closes revenue.
Coordinates DocuSign and Stripe for immediate pilot conversion.
"""
from __future__ import annotations
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from agentz.core.credentials import get
from agentz.core.docusign import create_envelope_from_markdown
from agentz.workflows.handlers.qron_stripe import create_stripe_payment_link

logger = logging.getLogger("agentz.closer")

_RECIPIENT_RE = re.compile(r"^\s*recipient:\s*(\S+@\S+)\s*$", re.IGNORECASE | re.MULTILINE)


async def check_demo_viewed(deal_id: str) -> bool:
    """
    Checks whether a lead has viewed their personalized microsite.

    There is no microsite_analytics table or any other engagement signal
    wired up yet, so this fails closed. It previously returned True
    unconditionally, which meant run_closing_loop() treated every deal in
    HubSpot as engaged and tried to autonomously close all of them.

    Do not make this return True until it queries a real signal.
    """
    return False


def _extract_recipient(agreement_path: str) -> Optional[str]:
    """
    Read the agreement's own declared recipient (`recipient: <email>`).

    Returns None if the file is unreadable or declares no recipient. The
    recipient must come from the agreement itself: the deal record's email
    is frequently a guess, and sending a signature request to a guessed
    address puts the wrong company's agreement in front of the wrong person.
    """
    try:
        text = Path(agreement_path).read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("Cannot read agreement %s: %s", agreement_path, exc)
        return None

    match = _RECIPIENT_RE.search(text)
    if not match:
        return None
    return match.group(1)


async def send_closing_package(
    supabase,
    deal_data: Dict[str, Any],
    agreement_path: str,
):
    """
    Sends the DocuSign agreement and Stripe payment link for one deal.

    `agreement_path` is required and must be passed explicitly. This used to
    guess the agreement by globbing filenames against the deal name and fall
    back to a generic `default_partnership.md` when nothing matched -- so a
    deal could be sent another company's agreement, or a placeholder one.

    Skips entirely (creating no payment link and no envelope) when the
    agreement declares no recipient.
    """
    deal_name = deal_data.get("name", "Strategic Lead")
    deal_id = deal_data.get("id", "0")

    recipient = _extract_recipient(agreement_path)
    if not recipient:
        logger.warning(
            "Skipping close for %s: agreement %s declares no recipient. "
            "Not falling back to the deal record's email, which is often a guess.",
            deal_name, agreement_path,
        )
        return {
            "deal_id": deal_id,
            "payment_url": None,
            "envelope_id": None,
            "envelope_status": "skipped_no_recipient",
            "package_sent": False,
        }

    # 1. Generate Stripe Checkout Link ($2,500 Setup)
    stripe_res = await create_stripe_payment_link(2500)
    payment_url = stripe_res.get("url")

    # 2. Dispatch DocuSign Agreement to the agreement's own recipient
    ds_res = await create_envelope_from_markdown(agreement_path, recipient)

    # docusign.create_envelope_from_markdown always sets "sent" explicitly;
    # tolerate its absence only for callers/mocks predating that contract.
    envelope_sent = bool(ds_res.get("sent", ds_res.get("envelope_id") is not None))

    if envelope_sent:
        logger.info(
            "Closing package dispatched for %s to %s. Payment: %s | Envelope: %s",
            deal_name, recipient, payment_url, ds_res.get("envelope_id"),
        )
    else:
        logger.warning(
            "Closing package for %s NOT fully dispatched -- payment link %s was "
            "created, but the agreement was not sent (docusign status: %s).",
            deal_name, payment_url, ds_res.get("status"),
        )

    return {
        "deal_id": deal_id,
        "recipient": recipient,
        "payment_url": payment_url,
        "envelope_id": ds_res.get("envelope_id"),
        "envelope_status": ds_res.get("status"),
        "package_sent": envelope_sent,
    }


async def run_closing_loop(supabase, agreements: Optional[Dict[str, str]] = None):
    """
    The main autonomous closer loop.

    `agreements` maps deal id -> agreement path. A deal is only closed if an
    agreement was explicitly supplied for it; there is no filename guessing
    and no default agreement. With no mapping, this does nothing and returns
    [] rather than closing deals against an assumed document.
    """
    if not agreements:
        logger.info(
            "run_closing_loop called with no agreement mapping -- doing nothing. "
            "Pass {deal_id: agreement_path} to close specific deals."
        )
        return []

    from agentz.core.hubspot import get_all_deals
    leads = await get_all_deals(limit=5)

    closings = []
    for lead in leads:
        agreement_path = agreements.get(str(lead["id"]))
        if not agreement_path:
            continue
        if await check_demo_viewed(lead["id"]):
            res = await send_closing_package(supabase, lead, agreement_path)
            closings.append(res)

    return closings
