"""Fail-closed verifier for AgentZ-signed deployment provenance.

The verifier does NOT fetch GitHub or Cloudflare itself. The caller MUST obtain
the expected source commit from the protected GitHub release and the expected
deployment/version IDs from an independently authenticated Cloudflare API read.
A signed self-report is not sufficient to establish those external facts.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from agentz.core.identity import DID_KEY, _B58

SCHEMA = "authichain.agentz.deployment-provenance/1"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _published_key() -> Ed25519PublicKey:
    if not DID_KEY.startswith("did:key:z"):
        raise ValueError("PUBLISHED_DID_KEY_INVALID")
    n = 0
    for char in DID_KEY.removeprefix("did:key:z"):
        n = n * 58 + _B58.index(char)
    raw = n.to_bytes(34, "big")
    if raw[:2] != bytes((0xed, 0x01)):
        raise ValueError("PUBLISHED_DID_KEY_INVALID")
    return Ed25519PublicKey.from_public_bytes(raw[2:])


def verify_deployment_provenance(
    attestation: dict,
    *,
    artifact: bytes,
    expected_source_sha: str,
    expected_deployment_id: str,
    expected_version_id: str,
    expected_workflow_run_id: str,
) -> bool:
    """True only when AgentZ signature AND independent external facts agree.

    Artifact must be the exact deployable bytes, not merely a local source tree.
    All expected_* values must come from authenticated sources independently
    retrieved by the verifier; never copy them out of the attestation.
    """
    try:
        if not isinstance(artifact, bytes) or not HEX40.fullmatch(expected_source_sha):
            return False
        if not all(isinstance(x, str) and x for x in
                   (expected_deployment_id, expected_version_id, expected_workflow_run_id)):
            return False
        header_b64, payload_b64, signature_b64 = attestation["jws"].split(".")
        header = json.loads(_decode(header_b64))
        payload = json.loads(_decode(payload_b64))
        if header != {"alg": "EdDSA", "typ": "AGENTZ-PROVENANCE+JWS", "kid": DID_KEY}:
            return False
        if payload != attestation["payload"] or payload.get("schema") != SCHEMA:
            return False
        expected = {
            "sourceCommit": expected_source_sha,
            "deploymentId": expected_deployment_id,
            "versionId": expected_version_id,
            "workflowRunId": expected_workflow_run_id,
            "artifactSha256": hashlib.sha256(artifact).hexdigest(),
        }
        if any(payload.get(key) != value for key, value in expected.items()):
            return False
        if not HEX64.fullmatch(payload["artifactSha256"]):
            return False
        if not isinstance(payload.get("signedAt"), str) or not payload["signedAt"]:
            return False
        _published_key().verify(_decode(signature_b64),
                                (header_b64 + "." + payload_b64).encode("ascii"))
        return True
    except (KeyError, ValueError, TypeError, AttributeError, OverflowError, UnicodeError, Exception):
        return False
