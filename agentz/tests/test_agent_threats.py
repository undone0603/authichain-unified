import pytest
from agentz.core.agent_threats import triage_agent_verification as triage


def test_missing_not_counterfeit():
    for candidate in (None, {}, {"valid": False, "reasons": ["AGENT_NOT_FOUND"]}, {"valid": False, "reasons": ["ISSUER_NOT_FOUND"]}):
        result = triage(candidate, from_canonical_verifier=True)
        assert result["state"] == "indeterminate"
        assert result["counterfeit_verdict"] is None
        assert result["authorizes_execution"] is False


def test_verified_signature_never_authorizes_action():
    r = triage({"valid": True, "reasons": []}, from_canonical_verifier=True)
    assert r["state"] == "valid_signed_message_only"
    assert not r["authorizes_execution"]


@pytest.mark.parametrize("signal", [
    "AGENT_ID_MISMATCH", "ORGANIZATION_MISMATCH", "SIGNATURE_INVALID",
    "ISSUER_SIGNATURE_INVALID", "MESSAGE_ID_CONFLICT", "MESSAGE_REPLAYED",
    "INTENT_MISMATCH", "CAPABILITY_NOT_GRANTED", "ROLE_MISMATCH",
])
def test_observed_tampering_requires_review_not_accusation(signal):
    r = triage({"valid": False, "reasons": [signal]}, from_canonical_verifier=True)
    assert r["state"] == "suspicious_evidence"
    assert r["recommended_action"] == "hold_for_human_review"
    assert r["signals"] == [signal]
    assert r["counterfeit_verdict"] is None


def test_contradictory_verifier_evidence_never_trusted():
    assert triage({"valid": True, "reasons": ["SIGNATURE_INVALID"]}, from_canonical_verifier=True)["state"] == "suspicious_evidence"


def test_malformed_reasons_fail_closed():
    for bad in (None, {}, {"valid": True, "reasons": "ok"}, {"valid": True, "reasons": [1]}):
        assert triage(bad, from_canonical_verifier=True)["state"] == "indeterminate"


def test_untrusted_self_report_cannot_claim_verification_or_accuse_peers():
    assert triage({"valid": True, "reasons": []})["state"] == "indeterminate"
    assert triage({"valid": False, "reasons": ["SIGNATURE_INVALID"]})["state"] == "indeterminate"
