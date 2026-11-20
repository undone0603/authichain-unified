"""Offline negative and positive tests: no network, no production key."""
import json
from datetime import datetime, timezone

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from agentz.core import mcp_receipt


class FakeResponse:
    status = 200
    def __init__(self, request):
        body = json.loads(request.data)
        self.raw = json.dumps({"jsonrpc": "2.0", "id": body["id"], "result": {"tools": []}}).encode()
    def __enter__(self):
        return self
    def __exit__(self, *_):
        return False
    def read(self, n):
        return self.raw


def test_no_identity_fails_closed(monkeypatch):
    monkeypatch.setattr(mcp_receipt, "identity_status", lambda now: {"can_sign_as_self": False})
    with pytest.raises(RuntimeError, match="AGENTZ_IDENTITY_NOT_PROVEN"):
        mcp_receipt.execute_and_sign()


def test_no_source_sha_fails_closed(monkeypatch):
    monkeypatch.setattr(mcp_receipt, "identity_status", lambda now: {"can_sign_as_self": True})
    monkeypatch.delenv("AGENTZ_SOURCE_SHA", raising=False)
    with pytest.raises(RuntimeError, match="SOURCE_SHA_REQUIRED"):
        mcp_receipt.execute_and_sign(source_sha="")


def test_untrusted_endpoint_fails_closed(monkeypatch):
    monkeypatch.setattr(mcp_receipt, "identity_status", lambda now: {"can_sign_as_self": True})
    with pytest.raises(RuntimeError, match="MCP_ENDPOINT_NOT_ALLOWLISTED"):
        mcp_receipt.execute_and_sign(endpoint="https://evil.example/mcp")


def test_signed_execution_binds_bytes(monkeypatch, tmp_path):
    key = Ed25519PrivateKey.generate()  # TEST ONLY: never an AgentZ production identity.
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    (tmp_path / mcp_receipt.KEY_FILE).write_bytes(pem)
    monkeypatch.setenv("AGENTZ_KEY_DIR", str(tmp_path))
    monkeypatch.setenv("AGENTZ_DEPLOYED_COMMIT_SHA", "a" * 40)
    monkeypatch.setattr(mcp_receipt, "DID_KEY", mcp_receipt.did_key_from_pem(pem))
    monkeypatch.setattr(mcp_receipt, "identity_status", lambda now: {"can_sign_as_self": True, "did_key": mcp_receipt.DID_KEY})
    receipt = mcp_receipt.execute_and_sign(opener=lambda req, timeout: FakeResponse(req),
                                            source_sha="a" * 40,
                                            now=datetime(2026, 11, 19, tzinfo=timezone.utc))
    assert mcp_receipt.verify_receipt(receipt, expected_execution_id=receipt["payload"]["executionId"])
    assert not mcp_receipt.verify_receipt(receipt, expected_execution_id="replayed-id")
    altered = dict(receipt, responseRaw=receipt["responseRaw"] + " ")
    assert not mcp_receipt.verify_receipt(altered)
    altered = dict(receipt, payload={**receipt["payload"], "sourceCommit": "b" * 40})
    assert not mcp_receipt.verify_receipt(altered)


def test_atomic_acceptance_rejects_replay(monkeypatch, tmp_path):
    from agentz.core import mcp_receipt_acceptance as acceptance
    monkeypatch.setattr(acceptance, "verify_receipt",
                        lambda receipt, expected_execution_id: expected_execution_id == receipt["payload"]["executionId"])
    receipt = {"jws": "test.only.not-a-real-signature", "payload": {"executionId": "challenge-123"}}
    db = tmp_path / "acceptance.sqlite3"
    assert not acceptance.consume_once(receipt, db, expected_execution_id="wrong-challenge")
    assert acceptance.consume_once(receipt, db, expected_execution_id="challenge-123")
    assert not acceptance.consume_once(receipt, db, expected_execution_id="challenge-123")


def test_deployment_sha_mismatch_fails_closed(monkeypatch):
    monkeypatch.setattr(mcp_receipt, "identity_status", lambda now: {"can_sign_as_self": True})
    monkeypatch.setenv("AGENTZ_DEPLOYED_COMMIT_SHA", "b" * 40)
    with pytest.raises(RuntimeError, match="DEPLOYED_SHA_ATTESTATION_REQUIRED"):
        mcp_receipt.execute_and_sign(source_sha="a" * 40)


def test_identity_challenge_signs_with_matching_key(monkeypatch, tmp_path):
    import base64
    key = Ed25519PrivateKey.generate()  # Offline test identity, never production.
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption())
    (tmp_path / mcp_receipt.KEY_FILE).write_bytes(pem)
    monkeypatch.setenv("AGENTZ_KEY_DIR", str(tmp_path))
    monkeypatch.setattr(mcp_receipt, "DID_KEY", mcp_receipt.did_key_from_pem(pem))
    monkeypatch.setattr(mcp_receipt, "identity_status",
                        lambda now: {"can_sign_as_self": True, "did_key": mcp_receipt.DID_KEY})
    challenge = "operator-challenge-123456789"
    proof = mcp_receipt.sign_identity_challenge(
        challenge=challenge, now=datetime(2026, 11, 19, tzinfo=timezone.utc))
    h, p, signature = proof["jws"].split(".")
    decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    assert json.loads(decode(h))["kid"] == mcp_receipt.DID_KEY
    assert json.loads(decode(p))["challenge"] == challenge
    key.public_key().verify(decode(signature), (h + "." + p).encode("ascii"))
    with pytest.raises(ValueError, match="INVALID_CHALLENGE"):
        mcp_receipt.sign_identity_challenge(challenge="short")
    with pytest.raises(ValueError, match="INVALID_CHALLENGE"):
        mcp_receipt.sign_identity_challenge(challenge="line" + chr(10) + "break" + "a" * 20)


def test_identity_challenge_refuses_unproven_key(monkeypatch):
    monkeypatch.setattr(mcp_receipt, "identity_status", lambda now: {"can_sign_as_self": False})
    with pytest.raises(RuntimeError, match="AGENTZ_IDENTITY_NOT_PROVEN"):
        mcp_receipt.sign_identity_challenge(challenge="challenge-at-least-16")
