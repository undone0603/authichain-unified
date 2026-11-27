"""Scoped AgentZ API tokens. Fail closed when nothing is configured.

`AGENT_SECRET` remains the full-privilege operator token. Optional
`AGENT_SECRET_READ`, `AGENT_SECRET_RUN`, and `AGENT_SECRET_CREDENTIALS`
restrict a caller to one scope. When only `AGENT_SECRET` is set, every
scope accepts it (unchanged). Comparisons use hmac.compare_digest on
fixed-length SHA-256 digests so token length cannot leak or 500.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from enum import Enum

from fastapi import Header, HTTPException

from agentz.core.credentials import get

SSE_COOKIE_NAME = "agentz_sse"
_SSE_TICKET_TTL_S = 3600
_SSE_TICKET_PREFIX = "sse|"


class Scope(str, Enum):
    READ = "read"
    RUN = "run"
    CREDENTIALS = "credentials"


_SCOPE_CRED_KEYS = {
    Scope.READ: "agent_secret_read",
    Scope.RUN: "agent_secret_run",
    Scope.CREDENTIALS: "agent_secret_credentials",
}


def _digest_equal(left: str, right: str) -> bool:
    """Constant-time equality for secrets of any length."""
    if not left or not right:
        return False
    left_digest = hashlib.sha256(left.encode("utf-8")).digest()
    right_digest = hashlib.sha256(right.encode("utf-8")).digest()
    return hmac.compare_digest(left_digest, right_digest)


def bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        return None
    token = authorization[len(prefix):]
    return token or None


def secrets_for_scope(scope: Scope) -> list[str]:
    """Configured secrets that may satisfy `scope`. Never logs values."""
    found: list[str] = []
    scoped = get(_SCOPE_CRED_KEYS[scope], required=False)
    if scoped:
        found.append(scoped)
    legacy = get("agent_secret", required=False)
    if legacy and not any(_digest_equal(legacy, existing) for existing in found):
        found.append(legacy)
    return found


def token_matches_any(provided: str | None, secrets: list[str]) -> bool:
    if not provided or not secrets:
        return False
    matched = False
    for secret in secrets:
        if _digest_equal(provided, secret):
            matched = True
    return matched


def verify_scope(scope: Scope, authorization: str | None) -> None:
    secrets = secrets_for_scope(scope)
    if not secrets:
        raise HTTPException(status_code=503, detail="agent secret not configured")
    provided = bearer_token(authorization)
    if not token_matches_any(provided, secrets):
        raise HTTPException(status_code=401, detail="Unauthorized")


def require_scope(scope: Scope):
    async def _dependency(authorization: str | None = Header(None)):
        verify_scope(scope, authorization)
        return True

    _dependency.__name__ = f"require_{scope.value}_token"
    return _dependency


def issue_sse_ticket(secret: str, *, now: float | None = None, ttl_s: int = _SSE_TICKET_TTL_S) -> str:
    """Short-lived HMAC ticket. The long-lived secret never goes in the cookie."""
    exp = int((now if now is not None else time.time()) + ttl_s)
    payload = f"{_SSE_TICKET_PREFIX}{exp}"
    sig = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def sse_ticket_valid(ticket: str | None, secrets: list[str], *, now: float | None = None) -> bool:
    if not ticket or "." not in ticket or not secrets:
        return False
    exp_s, sig = ticket.split(".", 1)
    if len(sig) != 64 or not all(c in "0123456789abcdef" for c in sig):
        return False
    try:
        exp = int(exp_s)
    except ValueError:
        return False
    if exp < int(now if now is not None else time.time()):
        return False
    payload = f"{_SSE_TICKET_PREFIX}{exp}".encode("utf-8")
    matched = False
    for secret in secrets:
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        if hmac.compare_digest(sig, expected):
            matched = True
    return matched


def verify_sse_auth(
    *,
    authorization: str | None,
    cookie: str | None,
    query_token: str | None = None,
) -> None:
    """Authorize an SSE client via Bearer or cookie ticket — never `?token=`.

    Native EventSource cannot set Authorization. Clients POST /launch/sse/session
    with a Bearer token; the response sets an HttpOnly cookie that EventSource
    sends automatically on same-origin (or withCredentials) requests. fetch()
    streams may keep using Authorization.
    """
    del query_token  # query tokens are ignored and never compared
    secrets = secrets_for_scope(Scope.READ)
    if not secrets:
        raise HTTPException(status_code=503, detail="agent secret not configured")
    provided = bearer_token(authorization)
    if token_matches_any(provided, secrets):
        return
    if sse_ticket_valid(cookie, secrets):
        return
    raise HTTPException(status_code=401, detail="Unauthorized")


def sse_ticket_from_authorization(authorization: str | None) -> str:
    """Issue a cookie ticket for a caller who already holds a read-scope Bearer."""
    secrets = secrets_for_scope(Scope.READ)
    if not secrets:
        raise HTTPException(status_code=503, detail="agent secret not configured")
    provided = bearer_token(authorization)
    if not token_matches_any(provided, secrets):
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Sign with the matching configured secret, not the caller-supplied copy.
    signing_secret = next(s for s in secrets if _digest_equal(provided or "", s))
    return issue_sse_ticket(signing_secret)
