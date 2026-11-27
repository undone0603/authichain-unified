"""Independent deployment provenance verifier: positive and adversarial fixtures."""
import base64
import hashlib
import json
from datetime import datetime, timezone

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from agentz.core import deployment_provenance as provenance
from agentz.core.identity import did_key_from_pem


def _b64(raw):
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def test_external_source_deployment_and_artifact_binding(monkeypatch):
    key = Ed25519PrivateKey.generate()  # test-only key, not AgentZ production
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption())
    monkeypatch.setattr(provenance, "DID_KEY", did_key_from_pem(pem))
    artifact = b"immutable-build-artifact-test"
    payload = {
        "schema": provenance.SCHEMA,
        "sourceCommit": "a" * 40,
        "artifactSha256": hashlib.sha256(artifact).hexdigest(),
        "deploymentId": "cloudflare-deployment-1",
        "versionId": "cloudflare-version-1",
        "workflowRunId": "protected-run-123",
        "signedAt": datetime(2026, 11, 19, tzinfo=timezone.utc).isoformat(),
    }
    header = {"alg": "EdDSA", "typ": "AGENTZ-PROVENANCE+JWS",
              "kid": provenance.DID_KEY}
    data = _b64(json.dumps(header, sort_keys=True).encode()) + "." + _b64(json.dumps(payload, sort_keys=True).encode())
    attestation = {"payload": payload, "jws": data + "." + _b64(key.sign(data.encode()))}
    args = dict(artifact=artifact, expected_source_sha="a" * 40,
                expected_deployment_id="cloudflare-deployment-1",
                expected_version_id="cloudflare-version-1",
                expected_workflow_run_id="protected-run-123")
    assert provenance.verify_deployment_provenance(attestation, **args)
    assert not provenance.verify_deployment_provenance(attestation, **{**args, "artifact": b"changed"})
    assert not provenance.verify_deployment_provenance(attestation, **{**args, "expected_source_sha": "b" * 40})
    assert not provenance.verify_deployment_provenance(attestation, **{**args, "expected_version_id": "wrong"})
    assert not provenance.verify_deployment_provenance(attestation, **{**args, "expected_workflow_run_id": "wrong"})
    assert not provenance.verify_deployment_provenance({**attestation, "payload": {**payload, "deploymentId": "forged"}}, **args)
    assert not provenance.verify_deployment_provenance({**attestation, "jws": attestation["jws"][:-2] + "xx"}, **args)


def test_untrusted_attestation_cannot_supply_its_own_external_facts():
    assert not provenance.verify_deployment_provenance(
        {"jws": "not.a.valid.jws"}, artifact=b"x", expected_source_sha="",
        expected_deployment_id="", expected_version_id="", expected_workflow_run_id="")


def test_agentz_producer_roundtrip_and_missing_identity(monkeypatch, tmp_path):
    from agentz.core import identity
    key = Ed25519PrivateKey.generate()  # offline fixture only
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption())
    (tmp_path / identity.KEY_FILE).write_bytes(pem)
    monkeypatch.setenv("AGENTZ_KEY_DIR", str(tmp_path))
    monkeypatch.setattr(provenance, "DID_KEY", did_key_from_pem(pem))
    monkeypatch.setattr(identity, "DID_KEY", provenance.DID_KEY)
    monkeypatch.setattr(identity, "identity_status", lambda now: {"can_sign_as_self": True})
    artifact = b"release-artifact-fixture"
    kwargs = dict(artifact=artifact, source_sha="c" * 40,
                  deployment_id="deployment-123", version_id="version-123",
                  workflow_run_id="run-123")
    signed = provenance.sign_deployment_provenance(**kwargs)
    assert provenance.verify_deployment_provenance(
        signed, artifact=artifact, expected_source_sha="c" * 40,
        expected_deployment_id="deployment-123", expected_version_id="version-123",
        expected_workflow_run_id="run-123")
    assert not provenance.verify_deployment_provenance(
        signed, artifact=b"wrong", expected_source_sha="c" * 40,
        expected_deployment_id="deployment-123", expected_version_id="version-123",
        expected_workflow_run_id="run-123")
    monkeypatch.setattr(identity, "identity_status", lambda now: {"can_sign_as_self": False})
    import pytest
    with pytest.raises(RuntimeError, match="AGENTZ_IDENTITY_NOT_PROVEN"):
        provenance.sign_deployment_provenance(**kwargs)
