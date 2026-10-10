from agentz.core.canonical_verification import is_positive_verification


def test_only_canonical_verified_true_is_positive():
    assert is_positive_verification({"decision": "verified", "valid": True})
    for decision in ("warning", "blocked", "revoked", "expired", "risk", "indeterminate", "not_found"):
        assert not is_positive_verification({"decision": decision, "valid": True})
    assert not is_positive_verification({"decision": "verified", "valid": False})
