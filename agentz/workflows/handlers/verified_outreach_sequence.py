"""
agentz.workflows.handlers.verified_outreach_sequence
------------------------------------------------------
Codifies the manually-verified outreach loop from the 2026-07-31 CRM audit
into a reusable, safe workflow, instead of leaving it as one-off chat
actions.

Background: that audit found 166 of 171 HubSpot deals were fabricated --
created directly via CRM tool calls with zero real contacts, spending
nothing to verify a company would ever actually receive an email. This
handler is the fix: it never treats "sent" as "real". A deal only gets a
verified contact record and an "outreach succeeded" note after Resend
independently reports the email as `delivered` -- a bounce is logged as a
bounce, not silently dropped or retried blindly.

Design choices driven by current cold-outreach research (checked
2026-07-31, see PR description for sources):
  - Fully autonomous SDR agents underperform hybrid (human-reviewed) setups
    by ~2.3x -- this workflow defaults to Mode.CONFIRM semantics via
    ExecutionContext.step(); it is not meant to be wired to a schedule
    under Mode.AUTO without a human first reviewing a CONFIRM/DRY_RUN pass.
  - Rate-limited sends (SEND_DELAY_SECONDS) to protect the sending
    domain's deliverability reputation -- bursting cold sends is the
    fastest way to get flagged as spam.
  - CAN-SPAM compliant footer (physical address + explicit opt-out
    instruction) on every email -- the manual session that inspired this
    handler didn't include one; real-world compliance requires it.

Explicitly NOT built here: automated reply detection / follow-up
sequencing. Real cadence research says multi-touch sequences roughly
double reply rates over a single email, but a real implementation needs
to check inbound replies (Gmail) before ever sending touch #2, or it risks
following up with someone who already responded -- worse than not
following up at all. `agentz.core.credentials` already has a `gmail_oauth`
key reserved for this; wiring it up is future work, not faked here.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.hubspot import get_all_deals, create_verified_contact_for_deal, add_deal_note
from agentz.core import resend_email

logger = logging.getLogger("agentz.verified_outreach")

# Seconds to wait between sends. Real B2B cold-email deliverability guidance
# is to ramp volume gradually on a domain rather than burst-send -- this is
# a conservative floor, not a throughput target.
SEND_DELAY_SECONDS = 3
# How long to wait after sending before checking Resend's delivery status.
# Delivery is often near-instant but can lag; a single check here is a
# floor, not a guarantee -- re-run the workflow later to catch stragglers
# still showing "sent" rather than "delivered" or "bounced".
STATUS_CHECK_DELAY_SECONDS = 5

# Per-brand sending identity. Keep in sync with shared/brands.ts on the
# Next.js side -- this is a separate Python-side copy because agentz has no
# import path into the TS app.
BRAND_SENDERS = {
    "strainchain": {
        "from_addr": "StrainChain <support@strainchain.io>",
        "reply_to": "authichain@gmail.com",
        "domain_guess": "{slug}.com",
        "product_line": "StrainChain",
        "pitch": (
            "a seed-to-sale provenance layer for cannabis operators — "
            "blockchain-anchored chain-of-custody records that sit "
            "alongside your existing METRC compliance data, with "
            "lab-cert hashing and geo-fenced custody tracking"
        ),
        "cta": "a 30-day pilot at no cost for one location",
    },
}

CAN_SPAM_FOOTER = (
    "\n\n---\n"
    "You're receiving this because your company was identified as a "
    "potential fit for a compliance pilot. Reply \"unsubscribe\" and "
    "we will not contact you again.\n"
    "StrainChain / AuthiChain, Roscommon, MI, USA"
)


# _BRAND_KEYWORDS / dealname parsing: this repo's HubSpot deal names mix
# "Company — Brand Product Description" and "Brand — Company description"
# ordering inconsistently (e.g. "Gage Cannabis — StrainChain 30-Day Pilot"
# vs "StrainChain — Acreage Holdings Cannabis MSO (12 States)"). Caught
# during a live-data dry-run check (2026-08-01) before this ever ran with
# real sends: passing the full dealname straight into a domain guesser
# produced garbage like "gagecannabisstrainchain30daypilot.com" for every
# single target -- a 100% bounce rate that would also look spammy to
# receiving mail servers. _extract_company_name fixes the parsing; the
# guess itself is still inherently a heuristic (see _guess_domain).
_BRAND_KEYWORDS = {"strainchain", "qron", "authichain", "govchain"}
_DEAL_SUFFIX_WORDS = {"mso", "pilot", "dispensary", "30day", "hotlead"}

# Real domains confirmed by hand this session (web research + actual Resend
# delivery) for companies where the generic name->domain heuristic cannot
# work -- e.g. "Gage Cannabis Company" trades as gageusa.com, nothing in
# the display name hints at that. Check this before guessing.
KNOWN_DOMAIN_OVERRIDES = {
    "gage cannabis": "gageusa.com",
    "skymint brands": "skymint.com",
    "skymint": "skymint.com",
}


def _extract_company_name(dealname: str) -> str:
    """
    Pulls the actual company name out of a free-text HubSpot dealname.
    Splits on the em-dash separator this CRM uses, keeps whichever segment
    isn't just the brand/product name, then strips a trailing parenthetical
    and known non-company suffix words.
    """
    segments = [s.strip() for s in re.split(r"\s*—\s*|\s+-\s+", dealname) if s.strip()]
    company = segments[0] if segments else dealname
    for seg in segments:
        words = set(re.findall(r"[a-z0-9]+", seg.lower()))
        if not words & _BRAND_KEYWORDS:
            company = seg
            break

    company = re.sub(r"\s*\([^)]*\)\s*$", "", company).strip()
    words = [w for w in company.split() if w.lower() not in _DEAL_SUFFIX_WORDS]
    return " ".join(words) if words else company


# Deal names matching these are not real sales prospects (funding/VC
# entries, internal pipeline-tracking placeholders, competitions) -- found
# during the same live-data dry-run check: "StrainChain — Dispensary
# Pipeline (Metrc Consolidation Opportunity)" and "StrainChain — Casa Verde
# Capital ($3M Seed)" both survived the has_verified_contact filter and
# would have guessed nonsense/generic domains (e.g. info@pipeline.com) --
# risking emailing a real, unrelated company by coincidence, not just a
# harmless bounce. Excluded outright rather than left to a bounce.
_NON_PROSPECT_PATTERNS = re.compile(
    r"\b(pipeline|capital|seed|competition|investor|vc|fund(ing)?)\b", re.IGNORECASE
)


def _is_non_prospect_deal(dealname: str) -> bool:
    return bool(_NON_PROSPECT_PATTERNS.search(dealname))


def _guess_domain(company_name: str) -> str:
    """
    Best-effort company -> domain guess (e.g. "Pure Options" ->
    pureoptions.com). This is intentionally naive -- it is NOT the
    verification step. Resend's delivery status after actually sending is
    the verification step. A wrong guess here just produces a bounce,
    which this workflow logs honestly rather than hides. Checks
    KNOWN_DOMAIN_OVERRIDES first for companies the heuristic can't get right.
    """
    override = KNOWN_DOMAIN_OVERRIDES.get(company_name.strip().lower())
    if override:
        return override

    slug = re.sub(r"[^a-z0-9]", "", company_name.lower())
    slug = re.sub(r"(inc|llc|co|corp|company|brands|holdings|group)$", "", slug)
    return f"{slug}.com"


def _build_pitch_email(company_name: str, brand: dict) -> tuple[str, str]:
    subject = f"METRC compliance audit trail for {company_name} — 30-day pilot, no cost"
    text = (
        f"Hi {company_name} team,\n\n"
        f"I'm reaching out about {brand['product_line']}, {brand['pitch']}.\n\n"
        f"I'd like to offer {brand['cta']} — no commitment, just a real look "
        f"at whether tamper-evident custody records reduce your audit "
        f"overhead. If it's useful, only then would we talk pricing for a "
        f"wider rollout.\n\n"
        f"Would a 15-minute call make sense to see if this is worth "
        f"piloting?\n\n"
        f"The {brand['product_line']} Team"
        f"{CAN_SPAM_FOOTER}"
    )
    return subject, text


async def _process_deal(deal: Dict[str, Any], brand: dict) -> Dict[str, Any]:
    """Send + verify + honestly log one deal. Returns an outcome summary dict."""
    dealname = deal.get("name", "Unknown")
    company_name = _extract_company_name(dealname)
    deal_id = deal["id"]
    candidate_email = f"info@{_guess_domain(company_name)}"
    subject, text = _build_pitch_email(company_name, brand)

    email_id = await resend_email.send_email(
        to=candidate_email,
        subject=subject,
        text=text,
        from_addr=brand["from_addr"],
        reply_to=brand["reply_to"],
        tags={"campaign": "verified-outreach-sequence", "deal_id": str(deal_id)},
    )

    if not email_id:
        await add_deal_note(deal_id, f"verified_outreach_sequence: send API call failed for {candidate_email}. Not logged as contact.")
        return {"deal": dealname, "email": candidate_email, "outcome": "send_failed"}

    await asyncio.sleep(STATUS_CHECK_DELAY_SECONDS)
    status = await resend_email.get_delivery_status(email_id)

    if resend_email.is_delivered(status):
        await create_verified_contact_for_deal(deal_id, candidate_email, company_name)
        await add_deal_note(
            deal_id,
            f"verified_outreach_sequence: sent to {candidate_email}, confirmed DELIVERED "
            f"(Resend id {email_id}). Contact added.",
        )
        return {"deal": dealname, "email": candidate_email, "outcome": "delivered"}

    if resend_email.is_failed(status):
        await add_deal_note(
            deal_id,
            f"verified_outreach_sequence: attempted {candidate_email} -- {status.upper()} "
            f"(Resend id {email_id}). Address does not work; needs real contact research.",
        )
        return {"deal": dealname, "email": candidate_email, "outcome": status}

    await add_deal_note(
        deal_id,
        f"verified_outreach_sequence: sent to {candidate_email}, status still '{status}' "
        f"after {STATUS_CHECK_DELAY_SECONDS}s (Resend id {email_id}). Not yet confirmed "
        f"delivered -- re-run this workflow later to check again before treating as real.",
    )
    return {"deal": dealname, "email": candidate_email, "outcome": f"unconfirmed:{status}"}


def run(ctx: ExecutionContext, brand_key: str = "strainchain", max_deals: int = 10) -> str:
    brand = BRAND_SENDERS.get(brand_key)
    if not brand:
        return f"Unknown brand '{brand_key}'. Known: {list(BRAND_SENDERS.keys())}"

    ctx.step(f"--- VERIFIED OUTREACH SEQUENCE: {brand['product_line']} ---")

    if ctx.mode == Mode.DRY_RUN:
        deals = [{"id": "dry-run-1", "name": "Example StrainChain Dispensary", "has_verified_contact": False}]
    else:
        deals = ctx.step("Fetch HubSpot deals", action=lambda: asyncio.run(get_all_deals(limit=200)))
        if deals is None:
            deals = []

    targets = [
        d for d in deals
        if brand["product_line"].lower() in d.get("name", "").lower()
        and not d.get("has_verified_contact")
        and not _is_non_prospect_deal(d.get("name", ""))
    ][:max_deals]

    if not targets:
        return f"No unverified {brand['product_line']} deals found (either none exist, or all already have a real contact)."

    ctx.step(f"Found {len(targets)} unverified {brand['product_line']} deals to attempt.")

    # Multiple deal records often represent the same real company under
    # different names ("Curaleaf", "Curaleaf Holdings", "StrainChain --
    # Curaleaf Cannabis MSO" are 3 separate deals for one real business --
    # found in the same live-data check). Without this, a single run would
    # email the same real inbox multiple times. Dedupe by guessed address
    # within this run; each skipped duplicate is logged so it's visible
    # rather than silently dropped.
    seen_emails: set[str] = set()
    outcomes: List[Dict[str, Any]] = []
    for i, deal in enumerate(targets):
        candidate_email = f"info@{_guess_domain(_extract_company_name(deal.get('name', '')))}"
        if candidate_email in seen_emails:
            ctx.step(f"Skipping {deal.get('name')}: already targeted {candidate_email} earlier in this run")
            outcomes.append({"deal": deal.get("name"), "email": candidate_email, "outcome": "duplicate_skipped"})
            continue
        seen_emails.add(candidate_email)

        result = ctx.step(
            f"Verified-outreach attempt {i + 1}/{len(targets)}: {deal.get('name')}",
            action=lambda d=deal: asyncio.run(_process_deal(d, brand)),
        )
        if result:
            outcomes.append(result)
        if ctx.mode != Mode.DRY_RUN and i < len(targets) - 1:
            asyncio.run(asyncio.sleep(SEND_DELAY_SECONDS))

    delivered = sum(1 for o in outcomes if o["outcome"] == "delivered")
    failed = sum(1 for o in outcomes if o["outcome"] in resend_email.FAILED_STATUSES)
    duplicates = sum(1 for o in outcomes if o["outcome"] == "duplicate_skipped")
    unconfirmed = len(outcomes) - delivered - failed - duplicates

    return (
        f"Verified outreach complete for {brand['product_line']}: "
        f"{delivered} delivered (contact added), {failed} bounced/failed "
        f"(logged, no contact added), {duplicates} skipped as duplicates "
        f"(same guessed address as another deal this run), "
        f"{unconfirmed} unconfirmed (re-check later)."
    )
