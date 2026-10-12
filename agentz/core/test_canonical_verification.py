from agentz.core.canonical_verification import (
    authorize_capability,
    is_positive_verification,
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
