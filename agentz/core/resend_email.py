"""
agentz.core.resend_email
-------------------------
Transactional email via Resend, built specifically so callers can verify
delivery before treating an email address as real.

2026-07-31 finding: an earlier session's CRM had ~166 fabricated deals
because nothing in the pipeline distinguished "we sent an email" from
"a real inbox received it". `send_email` returns Resend's id; callers
MUST pass that id to `get_delivery_status` and only treat a contact as
verified when the status is "delivered" -- "queued" or "sent" is not
proof anyone real is on the other end, and "bounced"/"failed" is proof
they are not.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from agentz.core.credentials import get

logger = logging.getLogger("agentz.resend_email")

RESEND_API = "https://api.resend.com"

# Statuses Resend returns that count as a real, delivered email.
DELIVERED_STATUSES = {"delivered", "delivered_delayed"}
# Statuses that prove the address does NOT work -- never retry these blindly.
FAILED_STATUSES = {"bounced", "failed", "complained"}


async def send_email(
    to: str,
    subject: str,
    text: str,
    from_addr: str,
    reply_to: Optional[str] = None,
    tags: Optional[dict[str, str]] = None,
) -> Optional[str]:
    """
    Sends one transactional email. Returns the Resend email id on success,
    None if the API call itself failed (auth/network -- not the same as a
    bounce, which is a real send that failed to reach the inbox).
    """
    api_key = get("resend_api_key", required=False)
    if not api_key:
        logger.warning("resend_api_key missing. Cannot send email.")
        return None

    payload: dict = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = [reply_to]
    if tags:
        payload["tags"] = [{"name": k, "value": v} for k, v in tags.items()]

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{RESEND_API}/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            if r.status_code in (200, 201):
                return r.json().get("id")
            logger.error(f"Resend send failed: {r.status_code} {r.text}")
            return None
    except Exception as e:
        logger.error(f"Resend send exception: {e}")
        return None


async def get_delivery_status(email_id: str) -> str:
    """
    Returns Resend's actual delivery status for a sent email
    ("delivered", "bounced", "sent", "queued", "failed", ...), or "unknown"
    if the lookup itself failed. Never assume "sent" means "delivered".
    """
    api_key = get("resend_api_key", required=False)
    if not api_key or not email_id:
        return "unknown"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{RESEND_API}/emails/{email_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if r.status_code == 200:
                return r.json().get("last_event") or r.json().get("status") or "unknown"
            logger.error(f"Resend status lookup failed: {r.status_code} {r.text}")
            return "unknown"
    except Exception as e:
        logger.error(f"Resend status lookup exception: {e}")
        return "unknown"


def is_delivered(status: str) -> bool:
    return status in DELIVERED_STATUSES


def is_failed(status: str) -> bool:
    return status in FAILED_STATUSES
