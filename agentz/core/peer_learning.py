"""Evidence-bounded AgentZ learning from publicly attributed peer observations.

This is an *operational learning queue*, not model-weight training, proof of
independent conformance, a reputation score, or authority to send messages.
All records are untrusted snapshots until independently reproduced.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit

KINDS = {"external_reply", "self_post", "test_report"}
OWNER_HANDLES = {"undone0603", "authichain", "agentz"}
ALLOWED_HOSTS = {"github.com", "gitlab.com"}
SUBJECTS = {"mcp_interop", "a2a_tck", "payment_integrity", "agent_identity"}
MAX_OBSERVATIONS = 20


def _public_source(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 1024:
        return None
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        return None
    try:
        url = urlsplit(value)
        if (url.scheme != "https" or url.hostname not in ALLOWED_HOSTS
                or url.username or url.password or url.port not in (None, 443)
                or url.query or url.fragment or not url.path.strip("/")):
            return None
    except ValueError:
        return None
    return value


def learn(observations: object) -> dict:
    """Return bounded work priorities. Never trust author or verdict claims."""
    if not isinstance(observations, list) or len(observations) > MAX_OBSERVATIONS:
        raise ValueError("bounded public observation list required")
    seen: set[tuple[str, str, str]] = set()
    items: list[dict] = []
    for record in observations:
        if not isinstance(record, dict):
            continue
        source = _public_source(record.get("source"))
        author = record.get("author")
        kind = record.get("kind")
        subject = record.get("subject")
        if (not source or not isinstance(author, str)
                or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", author)
                or kind not in KINDS or subject not in SUBJECTS):
            continue
        key = (source, author.casefold(), kind)
        if key in seen:
            continue
        seen.add(key)
        is_owner = author.casefold() in OWNER_HANDLES
        is_bot = author.casefold().endswith("bot") or author.casefold().startswith("duo-")
        if is_owner or is_bot or kind == "self_post":
            state, priority, action = (
                "self_or_automated_activity", 3, "await_independent_evidence"
            )
        elif kind == "test_report":
            state, priority, action = (
                "external_test_claim_unverified", 1, "reproduce_external_test"
            )
        else:
            state, priority, action = (
                "external_feedback_not_validation", 2, "request_specific_test_result"
            )
        items.append({
            "source": source,
            "subject": subject,
            "state": state,
            "priority": priority,
            "next_action": action,
            "independently_validated": False,
            "author_authority_verified": False,
            "outbound_allowed": False,
        })
    items.sort(key=lambda v: (v["priority"], v["subject"], v["source"]))
    return {
        "schema": "agentz.peer-learning.v1",
        "observations": items,
        "review_candidates": sum(v["priority"] < 3 for v in items),
        "independently_validated": 0,
        "external_side_effects": "none",
        "next_action": items[0]["next_action"] if items else "collect_public_evidence",
    }
