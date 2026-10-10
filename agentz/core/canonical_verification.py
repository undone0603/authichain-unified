"""AgentZ adapter for the AuthiChain canonical attestation worker.

AgentZ may interpret the returned evidence, but it must not replace the worker's
protocol decision with a local authenticity vocabulary.
"""

from __future__ import annotations

import os
from typing import Any

import requests


def verify_attestation(
    jws: str,
    *,
    expected_object_id: str | None = None,
    endpoint: str | None = None,
    timeout_seconds: float = 10.0,
) -> dict[str, Any]:
    """Return the actual canonical worker response, including its decision.

    Raises when the canonical endpoint is not configured or unreachable. A
    transport failure is deliberately not converted into ``verified``.
    """
    url = endpoint or os.getenv("AUTHICHAIN_CANONICAL_VERIFY_URL")
    if not url:
        raise RuntimeError("AUTHICHAIN_CANONICAL_VERIFY_URL not configured")
    body: dict[str, str] = {"jws": jws}
    if expected_object_id:
        body["expected_object_id"] = expected_object_id

    response = requests.post(url, json=body, timeout=timeout_seconds)
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("canonical verification returned a non-object response")
    payload["http_status"] = response.status_code
    return payload


def is_positive_verification(response: dict[str, Any]) -> bool:
    """Only the canonical ``verified`` + ``valid=true`` result is positive."""
    return response.get("decision") == "verified" and response.get("valid") is True
