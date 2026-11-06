"""Evidence-first marketplace lead review. No external actions or LLM calls.

A search result, low price, or unauthorized-reseller allegation never proves
counterfeiting or the brand's right to demand removal. Only produces a
private internal memo. This code does not contact sellers, send legal demands,
invoke an agent, submit takedowns, or exercise enforcement authority.
"""

from __future__ import annotations

from collections.abc import Mapping
import re
from urllib.parse import urlsplit


def _safe_label(value: object, limit: int = 120) -> str:
    if not isinstance(value, str):
        return "Not supplied"
    # Normalize potentially untrusted search snippets. Avoid multi-line
    # instructions impersonating approval or control messages.
    normalized = re.sub(r"\s+", " ", value).strip()
    normalized = "".join(ch for ch in normalized if ch.isprintable())
    return normalized[:limit] or "Not supplied"


def _valid_listing_link(value: object) -> bool:
    if not isinstance(value, str) or len(value) > 2048:
        return False
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    return (
        parsed.scheme in ("https", "http")
        and bool(parsed.hostname)
        and parsed.username is None
        and parsed.password is None
    )


def build_internal_review_memo(lead: Mapping[str, object], brand: str) -> str:
    """Return an explicitly unverified case lead, never a legal demand.

    Facts about brand rights, source identity, issuer records and authenticity
    are all unknown. The caller cannot approve enforcement with a boolean or
    narrative field, and `lead["issue"]` is deliberately ignored.
    """
    if not isinstance(lead, Mapping):
        raise ValueError("invalid_marketplace_lead")
    seller = _safe_label(lead.get("seller"))
    brand_label = _safe_label(brand)
    link_present = _valid_listing_link(lead.get("url"))
    return (
        "PRIVATE REVIEW LEAD ONLY — NO ENFORCEMENT AUTHORIZATION\n"
        f"Brand named by scout (unverified): {brand_label}\n"
        f"Seller named by scout (unverified): {seller}\n"
        f"Potential listing locator: {'PRESENT (not fetched or validated)' if link_present else 'MISSING OR INVALID'}\n"
        "Case classification: UNVERIFIED_MARKETPLACE_OBSERVATION\n"
        "Counterfeit finding: NOT_ESTABLISHED\n"
        "Rights ownership/authorization: NOT_VERIFIED\n"
        "Issuer signature and lifecycle: NOT_VERIFIED\n"
        "Physical-unit identity and product condition: NOT_VERIFIED\n"
        "Independent review and legal signoff: NOT_OBTAINED\n"
        "Next: preserve lawful source observations privately, confirm rights and "
        "listing provenance, verify actual issuer/product evidence, obtain "
        "authorized independent and legal review.\n"
        "Do not send cease-and-desist demands, takedowns, public allegations, "
        "bounty claims or regulatory filings from this note.\n"
    )
