"""Explicit CORS origin allowlist. Wildcards are refused."""
from __future__ import annotations

import os

DEFAULT_CORS_ORIGINS = (
    "https://authichain.com",  # pragma: allowlist secret
    "https://www.authichain.com",  # pragma: allowlist secret
    "https://agentz.authichain.com",  # pragma: allowlist secret
    "https://claw.authichain.com",  # pragma: allowlist secret
)

CORS_METHODS = ("GET", "POST", "OPTIONS")
CORS_HEADERS = ("Authorization", "Content-Type", "Last-Event-ID", "Cookie")


def cors_allow_origins(raw: str | None = None) -> list[str]:
    """Return the origin allowlist.

    Unset / blank `AGENTZ_CORS_ORIGINS` uses DEFAULT_CORS_ORIGINS (apex + AgentZ/claw hosts).
    A comma-separated override replaces the default. `*` and `null` are errors
    so a misconfigured host cannot reopen wildcard CORS.
    """
    value = raw if raw is not None else os.environ.get("AGENTZ_CORS_ORIGINS", "")
    if value is None or not str(value).strip():
        return list(DEFAULT_CORS_ORIGINS)
    origins = [item.strip() for item in str(value).split(",") if item.strip()]
    if not origins:
        raise ValueError("AGENTZ_CORS_ORIGINS parsed empty")
    for origin in origins:
        lowered = origin.lower()
        if origin == "*" or lowered in {"null", "undefined"} or "*" in origin:
            raise ValueError("AGENTZ_CORS_ORIGINS must not contain a wildcard")
        if "://" not in origin:
            raise ValueError("AGENTZ_CORS_ORIGINS entries must be full origins")
    return origins
