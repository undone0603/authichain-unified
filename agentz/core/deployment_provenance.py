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



def sign_deployment_provenance(
    *,
    artifact: bytes,
    source_sha: str,
    deployment_id: str,
    version_id: str,
    workflow_run_id: str,
    now=None,
) -> dict:
    """AgentZ signature over supplied release facts; independent verification required.

    This function does NOT assert that a deployment occurred. A protected
    release controller must obtain the values from authenticated GitHub and
    Cloudflare APIs and the actual deployable artifact. The signature proves
    only that the AgentZ key signed these bytes; independent verification
    must establish their truth.
    """
    import os
    from datetime import datetime, timezone
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from agentz.core.identity import KEY_FILE, did_key_from_pem, identity_status

    if not isinstance(artifact, bytes) or not artifact:
        raise ValueError("ARTIFACT_REQUIRED")
    if not isinstance(source_sha, str) or not HEX40.fullmatch(source_sha):
        raise ValueError("SOURCE_SHA_REQUIRED")
    if not all(isinstance(x, str) and x and len(x) <= 256 for x in
               (deployment_id, version_id, workflow_run_id)):
        raise ValueError("RELEASE_IDENTIFIERS_REQUIRED")
    now = now or datetime.now(timezone.utc)
    status = identity_status(now)
    if not status["can_sign_as_self"]:
        raise RuntimeError("AGENTZ_IDENTITY_NOT_PROVEN")
    key_dir = os.environ.get("AGENTZ_KEY_DIR")
    if not key_dir:
        raise RuntimeError("KEY_UNBOUND")
    pem = (Path(key_dir) / KEY_FILE).read_bytes()
    if did_key_from_pem(pem) != DID_KEY:
        raise RuntimeError("KEY_MISMATCH")
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise RuntimeError("KEY_NOT_ED25519")
    payload = {
        "schema": SCHEMA,
        "sourceCommit": source_sha,
        "artifactSha256": hashlib.sha256(artifact).hexdigest(),
        "deploymentId": deployment_id,
        "versionId": version_id,
        "workflowRunId": workflow_run_id,
        "signedAt": now.isoformat().replace("+00:00", "Z"),
    }
    header = {"alg": "EdDSA", "typ": "AGENTZ-PROVENANCE+JWS", "kid": DID_KEY}
    canonical = lambda value: json.dumps(value, sort_keys=True, separators=(",", ":"),
                                         ensure_ascii=False, allow_nan=False).encode("utf-8")
    b64 = lambda raw: base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    signing_input = b64(canonical(header)) + "." + b64(canonical(payload))
    return {"payload": payload,
            "jws": signing_input + "." + b64(key.sign(signing_input.encode("ascii")))}


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
