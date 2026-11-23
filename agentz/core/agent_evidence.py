"""Agent Execution Evidence Gap Assessment.

Given one redacted, historical agent action, decide for each of four dimensions
whether the buyer's evidence can establish it, and what is missing:

- principal: who the agent acted for
- permission_scope: what the agent was allowed to do
- execution_outcome: what actually happened
- settlement: who paid whom, and how much (beneficiary)

States, per dimension:
- verified      checked independently: on-chain (Base USDC + EIP-3009) or a
                signed record verified by AuthiChain's hosted verify_record
- asserted      present, but only as an unsigned claim, log or declaration
- missing       no evidence supplied
- contradicted  the supplied evidence disagrees with the claim

Never outputs "authentic" or a trust score. A verified signature proves who
signed, not that the action was wise or the counterparty honest. Nothing here
signs, pays, or runs a verifier on the AgentZ host: on-chain reads use a public
RPC and signed records go through the hosted MCP tool.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Callable

from agentz.core.verification_workflow import record_verdict

STATES = ("verified", "asserted", "missing", "contradicted")
TOLERANCE_USDC = 0.000001

# Injected dependencies, so the assessment is testable without network:
#   prove(tx_hash, pay_to) -> settlement_proof.prove_settlement(...) result dict
#   verify_record(arguments) -> result dict from the hosted verify_record tool
Prove = Callable[[str, str], dict[str, Any]]
VerifyRecord = Callable[[dict[str, Any]], dict[str, Any]]


def _addr(v: Any) -> str | None:
    s = str(v or "").strip().lower()
    return s if s.startswith("0x") and len(s) == 42 else None


def _dim(state: str, evidence: list[str], gaps: list[str], to_close: list[str]) -> dict[str, Any]:
    assert state in STATES
    return {"state": state, "evidence": evidence, "gaps": gaps, "to_close": to_close}


def _parse_time(v: Any) -> datetime | None:
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _settlement(claimed: dict, ev: dict, prove: Prove) -> tuple[dict, dict | None]:
    tx = ev.get("settlement_tx")
    beneficiary = _addr(claimed.get("beneficiary"))
    if not tx:
        return _dim("missing", [], ["No settlement transaction supplied."],
                    ["Supply the Base transaction hash of the payment."]), None
    if not beneficiary:
        return _dim("asserted", [f"tx {tx}"], ["No beneficiary address claimed, so the payee cannot be checked."],
                    ["State the beneficiary's on-chain address."]), None
    try:
        proof = prove(tx, beneficiary)
    except Exception as exc:  # unknown tx, RPC down: we could not check
        return _dim("asserted", [f"tx {tx}"], [f"Could not read the transaction: {exc}"],
                    ["Re-run when the chain is reachable, or confirm the network (Base mainnet USDC only)."]), None
    c = proof["checks"]
    evidence = [f"tx {tx} in block {proof['block_number']}", f"payer {proof['payer']}",
                f"{proof['amount_usdc']} USDC to {beneficiary}" if proof.get("amount_usdc") is not None else "no transfer to claimed beneficiary"]
    if not c["receipt_status_success"]:
        return _dim("contradicted", evidence, ["The transaction failed on-chain."], []), proof
    if not c["single_usdc_transfer_to_pay_to"]:
        return _dim("contradicted", evidence,
                    ["The transaction does not pay the claimed beneficiary exactly once in Base USDC."], []), proof
    claimed_amt = claimed.get("amount_usdc")
    if claimed_amt is not None and abs(float(claimed_amt) - float(proof["amount_usdc"])) > TOLERANCE_USDC:
        return _dim("contradicted", evidence,
                    [f"Claimed {claimed_amt} USDC, but the chain shows {proof['amount_usdc']} USDC."], []), proof
    if not c["eip3009_authorization_used_by_payer"]:
        return _dim("asserted", evidence,
                    ["A plain transfer: no payer-signed EIP-3009 authorization, so nothing ties it to an agent purchase."],
                    ["Settle through x402 so the payer's signed authorization is consumed on-chain."]), proof
    if not c["block_hash_matches"]:
        return _dim("asserted", evidence, ["Block hash did not match; re-check after finality."], []), proof
    evidence.append(f"payer-signed EIP-3009 authorization used (settled via {proof.get('facilitator', 'unknown')})")
    return _dim("verified", evidence, [], []), proof


def _principal(claimed: dict, ev: dict, proof: dict | None, settled: bool,
               verify_record: VerifyRecord | None) -> tuple[dict, dict | None]:
    principal = claimed.get("principal")
    if not principal:
        return _dim("missing", [], ["No principal claimed."], ["Name who the agent acted for (address or DID)."]), None
    p_addr = _addr(principal)
    if settled and p_addr and proof:
        if proof.get("payer") == p_addr:
            return _dim("verified", [f"{p_addr} signed the EIP-3009 authorization that settled tx {proof['tx_hash']}"],
                        [], []), None
        return _dim("contradicted", [f"on-chain payer {proof.get('payer')}"],
                    [f"Claimed principal {p_addr} did not sign the payment; {proof.get('payer')} did."], []), None
    rec = ev.get("signed_record")
    if rec and verify_record:
        result = verify_record({k: v for k, v in rec.items() if k in ("record", "anchor", "id")})
        verdict = record_verdict(result)
        subject = str(((rec.get("record") or {}).get("credentialSubject") or {}).get("id") or "")
        issuer = str(((result.get("signer") or {}).get("did")) or "")
        names = {subject.lower(), issuer.lower()} - {""}
        evidence = [f"hosted verify_record verdict: {verdict}"]
        if verdict == "verified" and str(principal).lower() in names:
            return _dim("verified", evidence + [f"signed by {issuer or 'issuer'} for {principal}"], [], []), result
        if verdict == "verified_demonstration_only":
            return _dim("asserted", evidence, ["The record is signed with a demonstration key, not a production issuer."],
                        ["Sign the record with the principal's production key."]), result
        if verdict == "verified":
            return _dim("contradicted", evidence, [f"The signed record names {sorted(names)}, not {principal}."], []), result
        return _dim("asserted", evidence, ["The signed record did not verify."],
                    ["Supply the original signed record and anchor unchanged."]), result
    return _dim("asserted", [f"claimed principal {principal}"],
                ["The principal is only stated, not signed or settled by them."],
                ["Supply a settlement signed by the principal's key, or a record signed by the principal."]), None


def _scope_coverage(scope: dict, claimed: dict) -> list[str]:
    """Return reasons the declared scope does NOT cover the claimed action."""
    problems = []
    amt, max_amt = claimed.get("amount_usdc"), scope.get("max_amount_usdc")
    if amt is not None and max_amt is not None and float(amt) > float(max_amt) + TOLERANCE_USDC:
        problems.append(f"amount {amt} USDC exceeds the scope limit {max_amt} USDC")
    payees = [p.lower() for p in scope.get("payees") or []]
    ben = _addr(claimed.get("beneficiary"))
    if payees and ben and ben not in payees:
        problems.append(f"beneficiary {ben} is not an allowed payee")
    actions = scope.get("actions") or []
    if actions and claimed.get("action") and claimed["action"] not in actions:
        problems.append(f"action '{claimed['action']}' is not in the allowed actions {actions}")
    when = _parse_time(claimed.get("occurred_at"))
    nb, na = _parse_time(scope.get("not_before")), _parse_time(scope.get("not_after"))
    if when and nb and when < nb:
        problems.append("the action happened before the scope started")
    if when and na and when > na:
        problems.append("the action happened after the scope expired")
    return problems


def _scope(claimed: dict, ev: dict, settled: bool, verify_record: VerifyRecord | None) -> dict:
    mandate = ev.get("mandate")
    per_tx = ["The settled EIP-3009 authorization proves consent to this one transfer, not a standing permission."] if settled else []
    if not mandate:
        return _dim("missing", per_tx, ["No mandate or permission scope supplied."],
                    ["Supply the mandate the agent operated under (limits, payees, actions, validity window), ideally signed by the principal."])
    scope = mandate.get("scope") or {}
    problems = _scope_coverage(scope, claimed)
    if problems:
        return _dim("contradicted", [f"scope {scope}"], problems, [])
    if mandate.get("type") == "authichain_signed_record" and verify_record:
        result = verify_record({k: v for k, v in mandate.items() if k in ("record", "anchor", "id")})
        verdict = record_verdict(result)
        if verdict == "verified":
            return _dim("verified", per_tx + [f"signed mandate verified (hosted verify_record)", f"scope {scope} covers the action"], [], [])
        gap = ("The mandate is signed with a demonstration key." if verdict == "verified_demonstration_only"
               else "The signed mandate did not verify.")
        return _dim("asserted", per_tx + [f"hosted verify_record verdict: {verdict}"], [gap],
                    ["Have the principal sign the mandate with a production key."])
    return _dim("asserted", per_tx + [f"declared scope {scope} covers the action"],
                ["The scope is declared, not signed by the principal, so anyone could have written it."],
                ["Have the principal sign the mandate (for example as an AuthiChain signed record)."])


def _outcome(ev: dict, proof: dict | None, settled: bool, verify_record: VerifyRecord | None) -> dict:
    out = ev.get("outcome")
    if not out:
        return _dim("missing", [], ["No execution outcome supplied."],
                    ["Supply the response or receipt the agent received, including any transaction reference."])
    kind = out.get("type")
    if kind == "signed_receipt" and verify_record:
        verdict = record_verdict(verify_record({k: v for k, v in out.items() if k in ("record", "anchor", "id")}))
        if verdict == "verified":
            return _dim("verified", ["signed receipt verified (hosted verify_record)"], [], [])
        return _dim("asserted", [f"signed receipt verdict: {verdict}"], ["The receipt did not verify with a production key."],
                    ["Supply the counterparty's original signed receipt."])
    ref = str(out.get("tx") or "").lower()
    if settled and proof and ref and ref == proof["tx_hash"].lower():
        return _dim("verified", [f"{kind or 'response'} status {out.get('status')} references the proven tx {ref}"], [],
                    ["A counterparty-signed receipt would also bind what was delivered, not only that payment settled."])
    if ref and proof and ref != proof["tx_hash"].lower():
        return _dim("contradicted", [f"outcome references {ref}"], ["The outcome references a different transaction than the settlement."], [])
    return _dim("asserted", [f"{kind or 'unspecified'} outcome{(' status ' + str(out.get('status'))) if out.get('status') is not None else ''}"],
                ["The outcome is a log or response with nothing independently checkable."],
                ["Include the settlement transaction in the outcome, or a counterparty-signed receipt."])


def assess(action: dict[str, Any], *, prove: Prove, verify_record: VerifyRecord | None = None) -> dict[str, Any]:
    """Assess one agent action record. See the module docstring for the input and states."""
    if not isinstance(action, dict):
        raise ValueError("action must be a JSON object")
    claimed = action.get("claimed") or {}
    ev = action.get("evidence") or {}
    settlement, proof = _settlement(claimed, ev, prove)
    settled = settlement["state"] == "verified"
    principal, _ = _principal(claimed, ev, proof, settled, verify_record)
    dims = {
        "principal": principal,
        "permission_scope": _scope(claimed, ev, settled, verify_record),
        "execution_outcome": _outcome(ev, proof, settled, verify_record),
        "settlement": settlement,
    }
    states = [d["state"] for d in dims.values()]
    if "contradicted" in states:
        overall = "contradicted"
    elif all(s == "verified" for s in states):
        overall = "establishable"
    elif "verified" in states:
        overall = "partially_establishable"
    else:
        overall = "not_establishable"
    return {
        "action_id": action.get("action_id"),
        "overall": overall,
        "dimensions": dims,
        "scope_of_review": "Base mainnet USDC settlements and AuthiChain signed records. Other chains and signature formats are reported as asserted, not rejected.",
        "not_a_claim": "Verified means independently checked evidence, not that the action was correct, safe or authorised beyond what the evidence shows.",
    }


def live_dependencies() -> tuple[Prove, VerifyRecord]:
    """Read-only production wiring: public Base RPC and the hosted verify_record tool."""
    from agentz.integrations.authichain_mcp import HostedMCPClient, load_registry
    from agentz.integrations.settlement_proof import http_rpc, prove_settlement
    from agentz.integrations.x402_revenue import RevenueError, facilitator_signers

    try:
        signers = facilitator_signers()
    except RevenueError:
        signers = frozenset()
    rpc = http_rpc()
    client = HostedMCPClient(load_registry())

    def prove(tx: str, pay_to: str) -> dict[str, Any]:
        return prove_settlement(tx, rpc, pay_to=pay_to, signers=signers)

    def verify_record(arguments: dict[str, Any]) -> dict[str, Any]:
        out = client.call("authichain.mcp.verify_record", arguments)
        return out["result"] if isinstance(out.get("result"), dict) else {}

    return prove, verify_record


def cli_assess(path: str) -> int:
    import json
    from pathlib import Path

    action = json.loads(Path(path).read_text(encoding="utf-8"))
    prove, verify_record = live_dependencies()
    out = assess(action, prove=prove, verify_record=verify_record)
    print(json.dumps(out, indent=2))
    return {"establishable": 0, "partially_establishable": 0}.get(out["overall"], 1)
