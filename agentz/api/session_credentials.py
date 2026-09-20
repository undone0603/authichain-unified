"""
Allowlisted AgentZ session-cookie updates.

POST /credentials/{key} uses this so GitHub Actions can push
LINKEDIN_SESSION_COOKIE / JSESSIONID (and Reddit/X session cookies)
into the live AgentZ process. Values are never returned.
"""
from __future__ import annotations

ALLOWED_SESSION_KEYS = frozenset(
    {
        "linkedin_session",
        "linkedin_jsessionid",
        "reddit_session",
        "twitter_session",
    }
)


def apply_session_credential(key: str, value: str) -> dict[str, object]:
    """Persist an allowlisted session cookie. Never echoes `value`."""
    if key not in ALLOWED_SESSION_KEYS:
        raise ValueError(f"credential key not allowed: {key}")
    if not isinstance(value, str) or not value.strip():
        raise ValueError("credential value must be a non-empty string")

    from agentz.core.credentials import set_credential

    set_credential(key, value)
    return {"ok": True, "key": key}


def session_credential_status(key: str) -> dict[str, object]:
    """Presence/length only. Never includes the secret value."""
    if key not in ALLOWED_SESSION_KEYS:
        raise ValueError(f"credential key not allowed: {key}")

    from agentz.core.credentials import get, is_unset_or_placeholder

    val = get(key, required=False)
    present = bool(val) and not is_unset_or_placeholder(val)
    return {
        "ok": True,
        "key": key,
        "present": present,
        "length": len(val) if present and isinstance(val, str) else 0,
    }
