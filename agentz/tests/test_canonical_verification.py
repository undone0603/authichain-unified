from agentz.core.canonical_verification import (
    DEFAULT_CANONICAL_VERIFY_URL,
    authorize_capability,
    is_positive_verification,
    resolve_canonical_verify_url,
)


def test_resolve_canonical_verify_url_defaults_to_public_endpoint(monkeypatch):
    monkeypatch.delenv("AUTHICHAIN_CANONICAL_VERIFY_URL", raising=False)
    assert resolve_canonical_verify_url() == DEFAULT_CANONICAL_VERIFY_URL
    assert (
        resolve_canonical_verify_url(" https://custom.example/verify ")
        == "https://custom.example/verify"
    )


def test_only_verified_valid_is_positive():
    assert is_positive_verification({"decision": "verified", "valid": True}) is True
    assert is_positive_verification({"decision": "verified", "valid": False}) is False
    assert is_positive_verification({"decision": "not_found", "valid": False}) is False
    assert is_positive_verification({"decision": "revoked", "valid": False}) is False


def test_capability_requires_positive_verification_and_grant():
    verified = {"decision": "verified", "valid": True}
    denied_verify = authorize_capability(
        {"decision": "revoked", "valid": False},
        capability="issue_attestation",
        granted_capabilities={"issue_attestation"},
    )
    assert denied_verify["authorized"] is False
    assert denied_verify["reason"] == "verification_not_positive"

    denied_cap = authorize_capability(
        verified,
        capability="transfer_funds",
        granted_capabilities={"issue_attestation"},
    )
    assert denied_cap["authorized"] is False
    assert denied_cap["reason"] == "capability_not_granted"

    allowed = authorize_capability(
        verified,
        capability="issue_attestation",
        granted_capabilities={"issue_attestation", "read_audit"},
    )
    assert allowed["authorized"] is True
    assert allowed["reason"] == "ok"


def test_verified_body_under_an_error_status_is_not_positive():
    verified = {"decision": "verified", "valid": True}
    assert is_positive_verification({**verified, "http_status": 200}) is True
    for status in (301, 400, 409, 503):
        assert is_positive_verification({**verified, "http_status": status}) is False
    denied = authorize_capability(
        {**verified, "http_status": 503},
        capability="issue_attestation",
        granted_capabilities={"issue_attestation"},
    )
    assert denied["authorized"] is False
    assert denied["reason"] == "verification_not_positive"


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_verify_attestation_rejects_a_body_outside_the_decision_contract(monkeypatch):
    import pytest
    from agentz.core import canonical_verification as cv

    for payload in ({"ok": True}, {"valid": "true", "decision": "verified"}, {"valid": True}):
        monkeypatch.setattr(cv.requests, "post", lambda *a, _p=payload, **k: _FakeResponse(200, _p))
        with pytest.raises(RuntimeError, match="decision contract"):
            cv.verify_attestation("a.b.c")


def test_verify_attestation_records_the_http_status(monkeypatch):
    from agentz.core import canonical_verification as cv

    monkeypatch.setattr(
        cv.requests, "post", lambda *a, **k: _FakeResponse(409, {"valid": False, "decision": "revoked"})
    )
    result = cv.verify_attestation("a.b.c")
    assert result["http_status"] == 409
    assert is_positive_verification(result) is False
