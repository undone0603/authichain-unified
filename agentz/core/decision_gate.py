# AgentZ port of AI Adapt research build 2026-10-07 Typed Decision Gate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-07-typed-decision-gate.md
"""decision_gate — typed-decision gate for agent actions (AI Adapt prototype, 2026-10-07).

Wraps a SystemOne/Clef-style typed decision model (choice / score / noul questions ->
calibrated probabilities in one forward pass) and turns the answers into a four-state
verdict BEFORE an agent acts: approve | abstain | block | missing_evidence.

Request/response shape follows the Cloudflare/clef model card (Apache-2.0).
The Workers AI REST input schema for @cf/cloudflare/clef is UNVERIFIED — the transport
is injectable so the HTTP call can be fixed without touching gate logic.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

VERDICTS = ("approve", "abstain", "block", "missing_evidence")


@dataclass
class Rule:
    """One gate rule over one question's answer."""
    question_id: str
    # for noul: require P(true) >= min_true to pass; for choice: allowed options
    min_true: Optional[float] = None
    allowed: Optional[List[str]] = None
    min_confidence: float = 0.0
    hard: bool = True  # hard fail -> block; soft fail -> abstain


@dataclass
class GateResult:
    verdict: str
    reasons: List[str] = field(default_factory=list)
    answers: Dict[str, Any] = field(default_factory=dict)
    request_sha256: str = ""

    def receipt(self, bot: str, action_type: str, target: str) -> Dict[str, Any]:
        """Row payload for public.agent_action_receipts (DB seals the hash chain)."""
        ledger_verdict = "approved" if self.verdict == "approve" else "abstained"
        return {
            "bot": bot,
            "action_type": action_type,
            "target": target,
            "verdict": ledger_verdict,
            "checks": {"gate_state": self.verdict, "reasons": self.reasons,
                       "request_sha256": self.request_sha256},
            "chosen": {"answers": self.answers},
            "rationale": "; ".join(self.reasons) or "all gate rules passed",
        }


def build_request(state: Any, questions: Dict[str, Dict[str, Any]], model: str = "clef") -> Dict[str, Any]:
    for qid, q in questions.items():
        if q.get("type") not in ("choice", "score", "noul"):
            raise ValueError(f"question {qid}: type must be choice|score|noul")
        if q["type"] == "choice" and not q.get("criteria"):
            raise ValueError(f"question {qid}: choice needs criteria")
    return {"model": model, "state": state, "questions": questions}


def canonical_sha256(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def workers_ai_transport(account_id: str, token: str, model: str = "@cf/cloudflare/clef",
                         http_post: Optional[Callable[..., Any]] = None) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    """Returns transport(request)->response. http_post(url, headers, body) is injectable for tests."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"

    def _post(request: Dict[str, Any]) -> Dict[str, Any]:
        if http_post is None:
            import urllib.request
            req = urllib.request.Request(url, data=json.dumps(request).encode(),
                                         headers={"Authorization": f"Bearer {token}",
                                                  "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                payload = json.loads(r.read())
        else:
            payload = http_post(url, {"Authorization": f"Bearer {token}"}, request)
        return payload.get("result", payload)
    return _post


class DecisionGate:
    def __init__(self, transport: Callable[[Dict[str, Any]], Dict[str, Any]], rules: List[Rule]):
        self.transport = transport
        self.rules = rules

    def evaluate(self, state: Any, questions: Dict[str, Dict[str, Any]],
                 required_evidence: Optional[List[str]] = None) -> GateResult:
        # Evidence-before-action: refuse to even ask the model if required evidence is absent.
        missing = [k for k in (required_evidence or [])
                   if not (isinstance(state, dict) and state.get(k) not in (None, "", [], {}))]
        request = build_request(state, questions)
        sha = canonical_sha256(request)
        if missing:
            return GateResult("missing_evidence", [f"missing evidence: {', '.join(missing)}"], {}, sha)
        try:
            response = self.transport(request)
        except Exception as e:  # model/transport failure is an explicit outcome, never a pass
            return GateResult("abstain", [f"decision model error: {type(e).__name__}: {e}"], {}, sha)
        answers = response.get("answers", {})
        reasons: List[str] = []
        hard_fail = soft_fail = False
        for rule in self.rules:
            a = answers.get(rule.question_id)
            if a is None:
                reasons.append(f"{rule.question_id}: no answer")
                soft_fail = True
                continue
            ok, why = self._check(rule, a)
            if not ok:
                reasons.append(f"{rule.question_id}: {why}")
                hard_fail |= rule.hard
                soft_fail |= not rule.hard
        verdict = "block" if hard_fail else "abstain" if soft_fail else "approve"
        return GateResult(verdict, reasons, answers, sha)

    @staticmethod
    def _check(rule: Rule, a: Dict[str, Any]):
        if rule.min_true is not None:
            p = a.get("probability", a.get("probabilities", {}).get("true"))
            if p is None:
                return False, "no probability"
            if p < rule.min_true:
                return False, f"P(true)={p:.2f} < {rule.min_true}"
        if rule.allowed is not None:
            c = a.get("choice")
            if c not in rule.allowed:
                return False, f"choice {c!r} not in {rule.allowed}"
        conf = a.get("confidence", 1.0 if rule.min_true is not None else 0.0)
        if conf < rule.min_confidence:
            return False, f"confidence {conf:.2f} < {rule.min_confidence}"
        return True, ""


# Ready-made gate for Battery Passport record publication (EU Battery Regulation context).
PASSPORT_QUESTIONS = {
    "grounded": {"type": "noul", "instructions":
                 "Is every field value in proposed_record supported by source_document?"},
    "premature": {"type": "noul", "instructions":
                  "Is publishing now premature (required checks not yet done)?"},
    "chemistry": {"type": "choice", "instructions": "Which battery chemistry does source_document state?",
                  "criteria": {"lfp": "LFP", "nmc": "NMC", "other": "Other chemistry", "unstated": "Not stated"}},
}

PASSPORT_RULES = [
    Rule("grounded", min_true=0.85, hard=True),
    Rule("chemistry", allowed=["lfp", "nmc", "other"], min_confidence=0.6, hard=False),
]


def passport_gate(transport) -> DecisionGate:
    return DecisionGate(transport, PASSPORT_RULES)


def premature_rule_check(answers: Dict[str, Any], max_true: float = 0.3) -> bool:
    p = answers.get("premature", {}).get("probability")
    return p is not None and p <= max_true
