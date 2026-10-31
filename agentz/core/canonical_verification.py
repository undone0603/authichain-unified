"""AgentZ adapter for the AuthiChain canonical attestation worker.

AgentZ may interpret the returned evidence, but it must not replace the worker's
protocol decision with a local authenticity vocabulary.
"""

from __future__ import annotations

import os
from typing import Any

import requests


DEFAULT_CANONICAL_VERIFY_URL = "https://authichain.com/api/v1/attestation/verify"


def resolve_canonical_verify_url(endpoint: str | None = None) -> str:
    """Prefer an explicit endpoint, then env, then the public production URL."""
    if endpoint and endpoint.strip():
        return endpoint.strip()
    env = (os.getenv("AUTHICHAIN_CANONICAL_VERIFY_URL") or "").strip()
    if env:
        return env
    return DEFAULT_CANONICAL_VERIFY_URL


def verify_attestation(
    jws: str,
    *,
    expected_object_id: str | None = None,
    endpoint: str | None = None,
    timeout_seconds: float = 10.0,
) -> dict[str, Any]:
    """Return the actual canonical worker response, including its decision.

    A transport failure is deliberately not converted into ``verified``.
    """
    url = resolve_canonical_verify_url(endpoint)
    body: dict[str, str] = {"jws": jws}
    if expected_object_id:
        body["expected_object_id"] = expected_object_id

    response = requests.post(url, json=body, timeout=timeout_seconds)
    payload = response.json()
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get("valid"), bool)
        or not isinstance(payload.get("decision"), str)
    ):
        # Same rule as verifyWithCanonicalWorker: a proxy error page or any
        # other shape is not a decision, so callers see a failure.
        raise RuntimeError("canonical verification returned a response outside the decision contract")
    payload["http_status"] = response.status_code
    return payload


def is_positive_verification(response: dict[str, Any]) -> bool:
    """Only the canonical ``verified`` + ``valid=true`` result is positive.

    When the HTTP status is known (``verify_attestation`` records it), it must
    be 2xx too, matching ``isCanonicalPositive`` in packages/verifier: a
    "verified" body under an error status is not positive.
    """
    status = response.get("http_status")
    if status is not None and not (isinstance(status, int) and 200 <= status < 300):
        return False
    return response.get("decision") == "verified" and response.get("valid") is True


def authorize_capability(
    response: dict[str, Any],
    *,
    capability: str,
    granted_capabilities: set[str] | frozenset[str] | list[str],
) -> dict[str, Any]:
    """Authorize an AgentZ action only after a positive canonical verification.

    Cryptographically valid alone is insufficient. The agent must also hold the
    requested capability. Failures are auditable structured denials.
    """
    granted = set(granted_capabilities)
    if not is_positive_verification(response):
        return {
            "authorized": False,
            "capability": capability,
            "reason": "verification_not_positive",
            "decision": response.get("decision"),
            "valid": response.get("valid"),
        }
    if capability not in granted:
        return {
            "authorized": False,
            "capability": capability,
            "reason": "capability_not_granted",
            "decision": response.get("decision"),
            "valid": response.get("valid"),
        }
    return {
        "authorized": True,
        "capability": capability,
        "reason": "ok",
        "decision": response.get("decision"),
        "valid": response.get("valid"),
    }
