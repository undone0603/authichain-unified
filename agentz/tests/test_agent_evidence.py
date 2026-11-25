"""Agent Execution Evidence Gap Assessment: offline tests with injected chain and verifier."""
import json
from pathlib import Path

import pytest

from agentz.core import agent_evidence as ae

PAYER = "0x" + "a" * 40
PAY_TO = "0x" + "b" * 40
OTHER = "0x" + "c" * 40
TX = "0x" + "1" * 64
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "agent_evidence"


def proof(**checks):
    base = {"receipt_status_success": True, "block_hash_matches": True,
            "single_usdc_transfer_to_pay_to": True, "eip3009_authorization_used_by_payer": True}
    base.update(checks)
    return {"tx_hash": TX, "block_number": 1, "payer": PAYER, "amount_usdc": 0.05,
            "facilitator": "other_facilitator", "checks": base}


def prover(result=None, exc=None):
    def prove(tx, pay_to):
        if exc:
            raise exc
        return result or proof()
    return prove


def verifier(verdict="verified", production=True, did="did:key:principal"):
    calls = []

    def verify(args):
        calls.append(args)
        return {"verdict": verdict, "demonstration": not production,
                "signer": {"did": did, "productionIssuer": production}}
    verify.calls = calls
    return verify


def action(**over):
    a = {"action_id": "t", "claimed": {"principal": PAYER, "action": "buy", "beneficiary": PAY_TO,
                                       "amount_usdc": 0.05, "occurred_at": "2026-11-22T15:50:00Z"},
         "evidence": {"settlement_tx": TX,
                      "mandate": {"type": "authichain_signed_record", "id": "m1",
                                  "scope": {"max_amount_usdc": 1, "payees": [PAY_TO], "actions": ["buy"],
                                            "not_before": "2026-11-01T00:00:00Z", "not_after": "2026-12-01T00:00:00Z"}},
                      "outcome": {"type": "http_response", "status": 200, "tx": TX}}}
    for k, v in over.items():
        a[k].update(v)
    return a


def test_fully_evidenced_action_is_establishable():
    out = ae.assess(action(), prove=prover(), verify_record=verifier())
    assert out["overall"] == "establishable"
    assert {d["state"] for d in out["dimensions"].values()} == {"verified"}


def test_nothing_supplied_is_missing_everywhere_except_asserted_principal():
    out = ae.assess({"claimed": {"principal": "acct-1"}, "evidence": {}}, prove=prover())
    dims = out["dimensions"]
    assert dims["principal"]["state"] == "asserted"
    assert [dims[k]["state"] for k in ("permission_scope", "execution_outcome", "settlement")] == ["missing"] * 3
    assert out["overall"] == "not_establishable"


def test_principal_who_did_not_sign_the_payment_is_contradicted():
    a = action(claimed={"principal": OTHER})
    out = ae.assess(a, prove=prover(), verify_record=verifier())
    assert out["dimensions"]["principal"]["state"] == "contradicted"
    assert out["overall"] == "contradicted"


@pytest.mark.parametrize("scope,needle", [
    ({"max_amount_usdc": 0.01}, "exceeds"),
    ({"payees": [OTHER]}, "not an allowed payee"),
    ({"actions": ["sell"]}, "not in the allowed actions"),
    ({"not_after": "2026-11-01T00:00:00Z"}, "expired"),
    ({"not_before": "2026-12-01T00:00:00Z"}, "before the scope started"),
])
def test_scope_that_does_not_cover_the_action_is_contradicted(scope, needle):
    a = action(evidence={"mandate": {"type": "declared", "scope": scope}})
    dim = ae.assess(a, prove=prover(), verify_record=verifier())["dimensions"]["permission_scope"]
    assert dim["state"] == "contradicted" and any(needle in g for g in dim["gaps"])


def test_declared_scope_is_only_asserted():
    a = action(evidence={"mandate": {"type": "declared", "scope": {"max_amount_usdc": 1}}})
    assert ae.assess(a, prove=prover())["dimensions"]["permission_scope"]["state"] == "asserted"


def test_demonstration_key_mandate_is_asserted_not_verified():
    v = verifier(production=False)
    dim = ae.assess(action(), prove=prover(), verify_record=v)["dimensions"]["permission_scope"]
    assert dim["state"] == "asserted" and "demonstration" in dim["gaps"][0]
    assert v.calls == [{"id": "m1"}]  # only record/anchor/id are forwarded


def test_amount_mismatch_with_chain_is_contradicted():
    a = action(claimed={"amount_usdc": 5.0})
    dim = ae.assess(a, prove=prover(), verify_record=verifier())["dimensions"]["settlement"]
    assert dim["state"] == "contradicted" and "0.05" in dim["gaps"][0]


def test_plain_transfer_without_authorization_is_asserted():
    out = ae.assess(action(), prove=prover(proof(eip3009_authorization_used_by_payer=False)), verify_record=verifier())
    assert out["dimensions"]["settlement"]["state"] == "asserted"
    assert out["dimensions"]["principal"]["state"] != "verified"


def test_failed_or_wrong_payee_tx_is_contradicted():
    for checks in ({"receipt_status_success": False}, {"single_usdc_transfer_to_pay_to": False}):
        out = ae.assess(action(), prove=prover(proof(**checks)), verify_record=verifier())
        assert out["dimensions"]["settlement"]["state"] == "contradicted"


def test_unreadable_chain_is_asserted_not_contradicted():
    out = ae.assess(action(), prove=prover(exc=RuntimeError("rpc down")), verify_record=verifier())
    assert out["dimensions"]["settlement"]["state"] == "asserted"
    assert "rpc down" in out["dimensions"]["settlement"]["gaps"][0]


def test_outcome_referencing_another_tx_is_contradicted():
    a = action(evidence={"outcome": {"type": "http_response", "status": 200, "tx": "0x" + "2" * 64}})
    dim = ae.assess(a, prove=prover(), verify_record=verifier())["dimensions"]["execution_outcome"]
    assert dim["state"] == "contradicted"


def test_signed_record_principal_must_be_named_by_the_record():
    a = action(claimed={"principal": "did:key:someone-else", "beneficiary": None},
               evidence={"settlement_tx": None, "signed_record": {"id": "r1"}})
    dim = ae.assess(a, prove=prover(), verify_record=verifier())["dimensions"]["principal"]
    assert dim["state"] == "contradicted"
    a["claimed"]["principal"] = "did:key:principal"
    assert ae.assess(a, prove=prover(), verify_record=verifier())["dimensions"]["principal"]["state"] == "verified"


def test_output_never_claims_authenticity_or_scores():
    text = json.dumps(ae.assess(action(), prove=prover(), verify_record=verifier())).lower()
    assert "authentic" not in text and "score" not in text


def test_sample_fixtures_are_well_formed():
    files = sorted(FIXTURES.glob("*.json"))
    assert len(files) >= 5
    for f in files:
        a = json.loads(f.read_text())
        assert a["action_id"] and isinstance(a["claimed"], dict) and isinstance(a["evidence"], dict)
