"""Evidence-only triage of canonical AuthiChain agent verification results.

This module never verifies cryptographic signatures, issues credentials, or
approves an action. It consumes the *canonical verifier's* result, and must
not be supplied an untrusted agent's self-reported ``valid`` value.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

# These are verifier failure *signals*, not declarations that the agent is
# counterfeit. An evidence contradiction may be accidental or malicious.
IMPERSONATION_SIGNALS = frozenset({
    "AGENT_ID_MISMATCH", "ORGANIZATION_MISMATCH", "ROLE_MISMATCH",
    "ISSUER_SIGNATURE_INVALID", "SIGNATURE_INVALID", "INTENT_MISMATCH",
    "MESSAGE_ID_CONFLICT", "MESSAGE_REPLAYED", "CAPABILITY_NOT_GRANTED",
})


def triage_agent_verification(result: Mapping[str, Any] | None) -> dict[str, Any]:
    """Classify evidence for a *human* review queue; never authorize activity.

    A positive state means the canonical verifier's response says its specific
    signed message was valid, not that a product, physical actor, or unknown
    peer was authenticated. This function is not a network trust boundary.
    """
    if not isinstance(result, Mapping):
        return _decision("indeterminate", [], "request_independent_verification")

    raw = result.get("reasons")
    if not isinstance(raw, list) or any(not isinstance(x, str) for x in raw):
        return _decision("indeterminate", [], "request_independent_verification")
    reasons = sorted(set(raw))[:30]
    if len(raw) > 30:
        return _decision("indeterminate", [], "request_independent_verification")
    signals = sorted(IMPERSONATION_SIGNALS.intersection(reasons))
    if signals:
        return _decision("suspicious_evidence", signals, "hold_for_human_review")
    if result.get("valid") is True and not reasons:
        return _decision("valid_signed_message_only", [], "independent_policy_and_authorization_required")
    return _decision("indeterminate", reasons, "request_independent_verification")


def _decision(state: str, signals: list[str], action: str) -> dict[str, Any]:
    return {
        "state": state,
        "signals": signals,
        "recommended_action": action,
        "authorizes_execution": False,
        "counterfeit_verdict": None,
        "basis": "canonical_verifier_result_only",
    }
