"""Left-Side Brain cycle.

Reads the existing launch state machine, ranks supplied opportunities, and
records a decision. It advances that machine only when the caller approved
the advance, the machine's own gates pass, and no supplied discovery
disagrees. A disagreement escalates. Neither side overrides the other.
It does not spend, send, deploy, set AgentZ auto, rewrite Founder law,
change a guardrail, or book revenue.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from agentz.core.launch_state import STAGE_ORDER, LaunchStateMachine, LaunchStage
from agentz.core.risk_firewall import assess_workflow

FACT_KINDS = (
    "verified_facts",
    "observations",
    "assumptions",
    "estimates",
    "hypotheses",
    "unknowns",
)

DECISION_FIELDS = (
    "objective",
    "evidence",
    "constraints",
    "options",
    "expected_outcome",
    "cost",
    "risk",
    "reversibility",
    "probability",
    "decision",
    "reason",
)

VALUE_CLASSES = (
    "cash_realized",
    "contracted_revenue",
    "pipeline_value",
    "modeled_value",
    "unverified_value",
)

RESOURCE_KINDS = (
    "money",
    "compute",
    "tokens",
    "time",
    "api",
    "human_attention",
    "system_capacity",
)

AUTHORITY = {
    "spend": "denied",
    "send": "denied",
    "deploy": "denied",
    "mode_auto": "denied",
    "AgentZ --mode auto": "denied",
    "founder_law_rewrite": "denied",
    "Founder-law rewrite": "denied",
    "guardrail_change": "denied",
    "guardrail change": "denied",
    "irreversible_commitment": "denied",
    "irreversible commitment": "denied",
}

_DENIED_REQUESTS = {
    "spend",
    "send",
    "deploy",
    "mode_auto",
    "auto",
    "agentz --mode auto",
    "agentz mode auto",
    "--mode auto",
    "founder_law_rewrite",
    "founder-law rewrite",
    "founder law rewrite",
    "guardrail_change",
    "guardrail change",
    "irreversible",
    "irreversible_commitment",
    "irreversible commitment",
}

_OPTIMIZATION_FIELDS = (
    "decision_accuracy",
    "execution_success",
    "verification_rate",
    "recovery_rate",
    "cost_per_useful_outcome",
    "resource_efficiency",
    "realized_revenue",
    "verified_value",
    "net_value",
    "human_escalation_rate",
    "mission_violations",
    "unauthorized_actions",
)

_FAILURE_LIMIT = 2


def classify_facts(signal: Mapping[str, Any] | None) -> dict[str, list[str]]:
    """Split a signal into fact classes. Non-facts never enter verified facts."""
    raw = signal if isinstance(signal, Mapping) else {}
    buckets = {kind: _strings(raw.get(kind)) for kind in FACT_KINDS}
    blocked = set(buckets["observations"])
    blocked.update(buckets["assumptions"])
    blocked.update(buckets["estimates"])
    blocked.update(buckets["hypotheses"])
    blocked.update(buckets["unknowns"])
    buckets["verified_facts"] = [item for item in buckets["verified_facts"] if item not in blocked]
    return buckets


def priority_score(
    value: float,
    probability: float,
    urgency: float,
    cost: float,
    risk: float,
    reversibility: float,
) -> dict[str, Any]:
    """(Value x Probability x Urgency) / (Cost x Risk x Reversibility)."""
    numerator = (value, probability, urgency)
    denominator = (cost, risk, reversibility)
    if any(not isinstance(item, (int, float)) or isinstance(item, bool) for item in numerator + denominator):
        return {"rankable": False, "score": None, "reason": "priority factors must be numbers"}
    if any(item < 0 for item in numerator) or any(item <= 0 for item in denominator):
        return {
            "rankable": False,
            "score": None,
            "reason": "cost, risk, and reversibility must be positive, and the numerator cannot be negative",
        }
    score = (value * probability * urgency) / (cost * risk * reversibility)
    return {"rankable": True, "score": round(float(score), 6), "reason": "ranked"}


def separate_value(raw: Mapping[str, Any] | None) -> dict[str, float | None]:
    """Copy only the supplied value class. Do not blend classes into cash."""
    separated: dict[str, float | None] = {name: None for name in VALUE_CLASSES}
    if not isinstance(raw, Mapping):
        return separated
    for name in VALUE_CLASSES:
        if name not in raw:
            continue
        amount = raw[name]
        if amount is None:
            separated[name] = None
        elif isinstance(amount, (int, float)) and not isinstance(amount, bool):
            separated[name] = amount
    return separated


def summarize_history(history: list[Any] | None) -> dict[str, Any]:
    """Rates from supplied rows only. Missing history stays unknown."""
    empty = {name: None for name in _OPTIMIZATION_FIELDS}
    rows = [row for row in (history or []) if isinstance(row, Mapping)]
    if not rows:
        empty["source"] = "no_supplied_history"
        empty["recommendations"] = _blank_recommendations()
        return empty
    total = len(rows)

    def _rate(flag: str) -> float:
        return round(sum(1 for row in rows if row.get(flag) is True) / total, 6)

    useful = [row for row in rows if row.get("useful") is True]
    cost_total = 0.0
    cost_seen = False
    for row in rows:
        cost = row.get("cost")
        if isinstance(cost, (int, float)) and not isinstance(cost, bool):
            cost_total += float(cost)
            cost_seen = True
    cash_rows = [
        float(row["cash_realized"])
        for row in rows
        if isinstance(row.get("cash_realized"), (int, float)) and not isinstance(row.get("cash_realized"), bool)
    ]
    verified_rows = [
        float(row["verified_value"])
        for row in rows
        if isinstance(row.get("verified_value"), (int, float)) and not isinstance(row.get("verified_value"), bool)
    ]
    report = {
        "decision_accuracy": _rate("decision_correct"),
        "execution_success": _rate("executed"),
        "verification_rate": _rate("verified"),
        "recovery_rate": _rate("recovered"),
        "cost_per_useful_outcome": None,
        "resource_efficiency": None,
        "realized_revenue": sum(cash_rows) if cash_rows else None,
        "verified_value": sum(verified_rows) if verified_rows else None,
        "net_value": None,
        "human_escalation_rate": _rate("escalated"),
        "mission_violations": sum(1 for row in rows if row.get("mission_violation") is True),
        "unauthorized_actions": sum(1 for row in rows if row.get("unauthorized") is True),
        "source": "caller_supplied_history",
        "idea_count_is_the_metric": False,
        "recommendations": _recommendations(rows),
    }
    if useful and cost_seen:
        report["cost_per_useful_outcome"] = round(cost_total / len(useful), 6)
    if cost_seen and cost_total > 0:
        report["resource_efficiency"] = round(len(useful) / cost_total, 6)
    if cash_rows and cost_seen:
        report["net_value"] = round(sum(cash_rows) - cost_total, 6)
        report["net_value_class"] = "cash_realized"
    return report


class LeftBrain:
    """One session over an injected LaunchStateMachine. Nothing is spent."""

    def __init__(self, state_machine: LaunchStateMachine):
        if not isinstance(state_machine, LaunchStateMachine):
            raise TypeError("state_machine must be the existing LaunchStateMachine")
        self.sm = state_machine
        self.applied: set[str] = set()
        self.failures = 0
        self.execution_attempts = 0
        self.used: dict[str, float] = {kind: 0.0 for kind in RESOURCE_KINDS}

    def cycle(self, signal: Mapping[str, Any] | None = None) -> dict[str, Any]:
        data = dict(signal) if isinstance(signal, Mapping) else {}
        gate_context = data.get("gate_context") if isinstance(data.get("gate_context"), Mapping) else {}
        gate_context = dict(gate_context)
        facts = classify_facts(data)
        economics = separate_value(data.get("economics") if isinstance(data.get("economics"), Mapping) else None)
        resources = self._resource_view(data.get("resources"), None)
        state = self._read_state(
            gate_context,
            economics=economics,
            approval=data.get("approval"),
            resources=resources,
            opportunities=data.get("opportunities"),
        )
        risks: list[str] = []
        if _mission_drift(data, self.sm.current_stage):
            risks.append("mission_drift")
        if _circular_execution(data):
            risks.append("circular_execution")
        if _unverified_claims(data):
            risks.append("unverified_claims")
        if _authority_requested(data):
            risks.append("authority_violation")
        if data.get("authority_updates"):
            risks.append("authority_boundary")
        if self.failures >= _FAILURE_LIMIT:
            risks.append("repeated_failures")
        history = summarize_history(data.get("history") if isinstance(data.get("history"), list) else None)
        base = {
            "mode": "IDLE / MONITOR",
            "fact_separation": facts,
            "state": state,
            "decisions": [],
            "priorities": [],
            "resources": resources,
            "economics": economics,
            "authority_denials": dict(AUTHORITY),
            "verification": _verification(False, False, False, [], economics),
            "risks": risks,
            "stopped": bool(risks),
            "optimization": history,
            "execution": {"status": "not_run", "attempts": self.execution_attempts},
            "revenue_ledger_written": False,
            "authority_boundary_modified": False,
        }
        if risks:
            reasons: list[str] = []
            if "mission_drift" in risks:
                reasons.append("The supplied mission stage does not match the launch machine.")
            if "circular_execution" in risks:
                reasons.append("The supplied actions are circular. The cycle stopped before repeating them.")
            if "unverified_claims" in risks:
                reasons.append("An unverified claim was presented as a verified fact. The cycle stopped.")
            if any(name in risks for name in ("authority_violation", "authority_boundary", "repeated_failures")):
                reasons.append("An authority boundary or repeated failure stopped the cycle.")
            base["decisions"] = [_decision_record(
                data,
                facts,
                None,
                state,
                decision="stop",
                reason=" ".join(reasons) or "The cycle stopped.",
            )]
            base["mode"] = "STOP"
            return base
        if not _worthwhile(data):
            base["execution"] = {"status": "idle", "attempts": self.execution_attempts}
            return base

        ranked = _rank(data.get("opportunities"))
        resources = self._resource_view(data.get("resources"), None)
        choice = _select(ranked, resources["available"])
        resources = self._resource_view(data.get("resources"), choice)
        base["priorities"] = ranked
        base["resources"] = resources
        record = _decision_record(data, facts, choice, state, decision=None, reason=None)
        base["decisions"] = [record]
        base["mode"] = "DECIDE"

        if choice is None:
            if any(row["rankable"] for row in ranked):
                base["risks"] = ["resource_exhaustion"]
                base["stopped"] = True
                base["mode"] = "STOP"
                record["decision"] = "stop"
                record["reason"] = "Rankable work does not fit the resources still available."
                base["execution"] = {"status": "stopped", "attempts": self.execution_attempts}
                base["resources"] = self._resource_view(data.get("resources"), ranked[0] if ranked else None)
                return base
            record["decision"] = "withhold"
            record["reason"] = "No supplied opportunity is rankable within the resources on hand."
            base["execution"] = {"status": "withheld", "attempts": self.execution_attempts}
            return base
        if _asks_for_spend(choice):
            base["risks"] = ["abnormal_spending"]
            base["stopped"] = True
            base["mode"] = "STOP"
            record["decision"] = "stop"
            record["reason"] = "The opportunity asks to spend. Spend is denied."
            base["execution"] = {"status": "stopped", "attempts": self.execution_attempts}
            return base
        if not _fits(choice, resources["available"]):
            base["risks"] = ["resource_exhaustion"]
            base["stopped"] = True
            base["mode"] = "STOP"
            record["decision"] = "stop"
            record["reason"] = "The highest-value opportunity does not fit the resources still available."
            base["execution"] = {"status": "stopped", "attempts": self.execution_attempts}
            return base

        action = str(choice.get("action") or "read_state")
        record["decision"] = action
        if action == "read_state":
            record["reason"] = "A state read is the smallest evidence step. It does not change the stage."
            base["verification"] = _verification(True, False, True, [state["current_stage"]], economics)
            base["execution"] = {"status": "read", "attempts": self.execution_attempts}
            return base
        if action != "advance_if_gates_pass":
            record["decision"] = "stop"
            record["reason"] = "The action is not an approved state-machine transition."
            base["mode"] = "STOP"
            base["stopped"] = True
            base["risks"] = ["unrecognized_action"]
            base["execution"] = {"status": "stopped", "attempts": self.execution_attempts}
            return base
        if data.get("approval") is not True:
            record["decision"] = "withhold"
            record["reason"] = "The state machine can advance only with explicit approval, and only if its gates pass."
            base["execution"] = {"status": "approval_required", "attempts": self.execution_attempts}
            return base

        other = _other_brain(data)
        if other is not None:
            record["decision"] = "escalate"
            record["reason"] = (
                "Evidence, constraints, risk, mission, and authority were checked. "
                "The discovery brain does not agree to a stage change. "
                "Neither side overrides the other. A human decision is required."
            )
            base["mode"] = "ESCALATE"
            base["stopped"] = True
            base["risks"] = ["disagreement"]
            base["human_decision_required"] = True
            base["disagreement"] = {
                "left": action,
                "right": other,
                "resolved_by": "human_decision_required",
                "checked": [
                    "evidence",
                    "constraints",
                    "risk",
                    "mission",
                    "authority",
                    "human_decision",
                ],
            }
            base["verification"] = _verification(False, False, False, [], economics)
            base["execution"] = {"status": "escalated", "attempts": self.execution_attempts}
            return base

        decision_id = _decision_id(data, action, gate_context)
        if decision_id in self.applied:
            record["reason"] = "This decision already ran. It was not repeated."
            base["execution"] = {
                "status": "idempotent_skip",
                "attempts": self.execution_attempts,
                "decision_id": decision_id,
            }
            base["risks"] = []
            return base

        firewall = assess_workflow(
            wf_id="left_brain_state_advance",
            risk_class="low",
            financial_limit_usd=0,
            requires_human_approval=True,
            current_mode="confirm",
            audit_log_path=self._audit_path(),
        )
        if not firewall.approved or firewall.vetoed:
            record["decision"] = "stop"
            record["reason"] = firewall.reason or "The existing risk firewall withheld the advance."
            base["mode"] = "STOP"
            base["stopped"] = True
            base["risks"] = ["firewall"]
            base["execution"] = {"status": "stopped", "attempts": self.execution_attempts}
            return base

        before = self.sm.current_stage
        self.execution_attempts += 1
        self._consume(choice)
        try:
            advanced = self.sm.advance(gate_context)
        except Exception as exc:
            self.failures += 1
            record["decision"] = "stop"
            record["reason"] = f"The state machine raised {type(exc).__name__}. The failure is recorded."
            base["mode"] = "STOP"
            base["stopped"] = True
            base["risks"] = ["execution_failure"]
            base["verification"] = _verification(False, False, False, [str(exc)], economics)
            base["execution"] = {"status": "failed", "attempts": self.execution_attempts}
            return base

        reread = LaunchStateMachine(state_file=self.sm.state_file)
        after = reread.current_stage
        expected = _next_stage(before)
        changed = after != before
        suspicious = advanced and expected is not None and after != expected
        evidence = [
            f"before={before.value}",
            f"after={after.value}",
            f"advance_returned={advanced}",
        ]
        verified = bool(advanced and changed and after == self.sm.current_stage and not suspicious)
        if suspicious:
            self.failures += 1
            base["risks"] = ["suspicious_state_transition"]
            base["stopped"] = True
            base["mode"] = "STOP"
            record["reason"] = "The stage change was not the next stage of the existing state machine."
            verified = False
        elif verified:
            self.applied.add(decision_id)
            record["reason"] = "The existing state machine advanced one stage after its gates passed."
            base["mode"] = "VERIFIED"
        else:
            self.failures += 1
            record["reason"] = "The state machine did not advance. No success is claimed."
            base["mode"] = "VERIFY_FAILED"
            if self.failures >= _FAILURE_LIMIT:
                base["risks"] = ["repeated_failures"]
                base["stopped"] = True
        view = self._resource_view(data.get("resources"), choice)
        base["resources"] = view
        base["state"] = self._read_state(
            gate_context,
            economics=economics,
            approval=data.get("approval"),
            resources=view,
            opportunities=data.get("opportunities"),
        )
        base["verification"] = _verification(True, changed, after == self.sm.current_stage, evidence, economics)
        base["verification"]["success"] = verified
        base["economics"] = economics
        base["execution"] = {
            "status": "advanced" if verified else "failed",
            "attempts": self.execution_attempts,
            "decision_id": decision_id,
        }
        return base

    def _read_state(
        self,
        gate_context: Mapping[str, Any],
        *,
        economics: Mapping[str, Any],
        approval: Any,
        resources: Mapping[str, Any],
        opportunities: Any,
    ) -> dict[str, Any]:
        assessment = self.sm.assess_stage(context=dict(gate_context))
        machine = self.sm.to_dict()
        return {
            "source": "LaunchStateMachine",
            "current_stage": self.sm.current_stage.value,
            "ready_to_advance": assessment.ready_to_advance,
            "passed": assessment.passed,
            "failed": assessment.failed,
            "blocking_gates": list(assessment.blocking_gates),
            "gates": [
                {"id": gate.id, "passed": gate.passed, "evidence": gate.evidence}
                for gate in assessment.gates
            ],
            "mission_state": {
                "stage": self.sm.current_stage.value,
                "source": "LaunchStateMachine",
                "history_count": len(machine.get("history") or []),
            },
            "dependencies": list(assessment.blocking_gates),
            "failures": self.failures,
            "approvals": {"advance": approval is True},
            "financial_state": dict(economics),
            "workflows": _unknown_list(),
            "tasks": _unknown_list(),
            "deadlines": _unknown_list(),
            "opportunities": _supplied_ids(opportunities),
            "resources": {
                "available": dict(resources.get("available") or {}),
                "used": dict(resources.get("used") or {}),
            },
        }

    def _resource_view(self, supplied: Any, choice: Mapping[str, Any] | None) -> dict[str, Any]:
        available = {kind: 0.0 for kind in RESOURCE_KINDS}
        if isinstance(supplied, Mapping):
            for kind in RESOURCE_KINDS:
                amount = supplied.get(kind)
                if isinstance(amount, (int, float)) and not isinstance(amount, bool):
                    available[kind] = max(0.0, float(amount) - self.used.get(kind, 0.0))
        return {
            "available": available,
            "used": dict(self.used),
            "highest_value_use": None if choice is None else choice.get("id"),
        }

    def _consume(self, choice: Mapping[str, Any]) -> None:
        needs = choice.get("resources") if isinstance(choice.get("resources"), Mapping) else {}
        for kind in RESOURCE_KINDS:
            amount = needs.get(kind, 0)
            if isinstance(amount, (int, float)) and not isinstance(amount, bool) and amount > 0:
                self.used[kind] = self.used.get(kind, 0.0) + float(amount)

    def _audit_path(self) -> Path:
        return Path(self.sm.state_file).with_name("left-brain-audit.jsonl")


def cycle(
    signal: Mapping[str, Any] | None = None,
    *,
    state_machine: LaunchStateMachine,
    brain: LeftBrain | None = None,
) -> dict[str, Any]:
    """Shipped entry. ``state_machine`` is the existing launch state machine."""
    engine = brain if brain is not None else LeftBrain(state_machine)
    return engine.cycle(signal)


def _unverified_claims(data: Mapping[str, Any]) -> bool:
    """True when a verified fact is also an observation, assumption, estimate, hypothesis, or unknown."""
    verified = set(_strings(data.get("verified_facts")))
    if not verified:
        return False
    for kind in FACT_KINDS:
        if kind == "verified_facts":
            continue
        if verified.intersection(_strings(data.get(kind))):
            return True
    return False


def _circular_execution(data: Mapping[str, Any]) -> bool:
    """True when supplied actions point at one another, including a step that points at itself."""
    opportunities = data.get("opportunities")
    if not isinstance(opportunities, list):
        return False
    edges: dict[str, list[str]] = {}
    for item in opportunities:
        if not isinstance(item, Mapping):
            continue
        node = item.get("id")
        if not isinstance(node, str) or not node.strip():
            continue
        raw = item.get("next")
        targets: list[str] = []
        if isinstance(raw, str) and raw.strip():
            targets.append(raw.strip())
        elif isinstance(raw, list):
            targets.extend(piece.strip() for piece in raw if isinstance(piece, str) and piece.strip())
        if targets:
            edges[node.strip()] = targets
    if not edges:
        return False
    white = 0
    gray = 1
    black = 2
    color: dict[str, int] = {}
    for start in edges:
        if color.get(start, white) != white:
            continue
        stack: list[tuple[str, bool]] = [(start, False)]
        while stack:
            node, finished = stack.pop()
            if finished:
                color[node] = black
                continue
            state = color.get(node, white)
            if state == gray:
                return True
            if state == black:
                continue
            color[node] = gray
            stack.append((node, True))
            for nxt in edges.get(node, []):
                seen = color.get(nxt, white)
                if seen == gray:
                    return True
                if seen == white:
                    stack.append((nxt, False))
    return False


def _mission_drift(data: Mapping[str, Any], stage: LaunchStage) -> bool:
    """True when the caller names a mission stage other than the machine's stage."""
    supplied = data.get("mission_state")
    if not isinstance(supplied, Mapping):
        return False
    claimed = supplied.get("stage")
    if not isinstance(claimed, str) or not claimed.strip():
        return False
    return claimed.strip() != stage.value


def _other_brain(data: Mapping[str, Any]) -> str | None:
    """None means no discovery was supplied. A discovery cannot authorize a stage change."""
    if "discovery" not in data:
        return None
    discovery = data.get("discovery")
    if isinstance(discovery, Mapping) and discovery.get("stops_before_execution") is True:
        return "stop_before_execution"
    return "unverified"


def _worthwhile(data: Mapping[str, Any]) -> bool:
    if _one_text(data.get("bottleneck")) or _one_text(data.get("problem")):
        return True
    opportunities = data.get("opportunities")
    return isinstance(opportunities, list) and any(isinstance(item, Mapping) for item in opportunities)


def _rank(opportunities: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not isinstance(opportunities, list):
        return rows
    for item in opportunities:
        if not isinstance(item, Mapping):
            continue
        scored = priority_score(
            item.get("value"),
            item.get("probability"),
            item.get("urgency"),
            item.get("cost"),
            item.get("risk"),
            item.get("reversibility"),
        )
        rows.append({
            "id": item.get("id"),
            "action": item.get("action"),
            "resources": dict(item.get("resources")) if isinstance(item.get("resources"), Mapping) else {},
            "value": item.get("value"),
            "probability": item.get("probability"),
            "urgency": item.get("urgency"),
            "cost": item.get("cost"),
            "risk": item.get("risk"),
            "reversibility": item.get("reversibility"),
            "rankable": scored["rankable"],
            "score": scored["score"],
            "reason": scored["reason"],
        })
    rows.sort(key=lambda row: (-(row["score"] if isinstance(row["score"], float) else -1.0), str(row["id"])))
    return rows


def _select(ranked: list[dict[str, Any]], available: Mapping[str, float]) -> dict[str, Any] | None:
    for row in ranked:
        if row["rankable"] and _fits(row, available):
            return row
    return None


def _fits(choice: Mapping[str, Any], available: Mapping[str, float]) -> bool:
    needs = choice.get("resources") if isinstance(choice.get("resources"), Mapping) else {}
    for kind, amount in needs.items():
        if not isinstance(amount, (int, float)) or isinstance(amount, bool):
            return False
        if float(amount) > float(available.get(kind, 0.0)):
            return False
    return True


def _asks_for_spend(choice: Mapping[str, Any]) -> bool:
    if str(choice.get("action") or "").strip().lower() in _DENIED_REQUESTS:
        return True
    needs = choice.get("resources") if isinstance(choice.get("resources"), Mapping) else {}
    money = needs.get("money", 0)
    return isinstance(money, (int, float)) and not isinstance(money, bool) and money > 0


def _decision_record(
    data: Mapping[str, Any],
    facts: Mapping[str, list[str]],
    choice: Mapping[str, Any] | None,
    state: Mapping[str, Any],
    *,
    decision: str | None,
    reason: str | None,
) -> dict[str, Any]:
    objective = _one_text(data.get("bottleneck")) or _one_text(data.get("problem")) or "Read the current launch stage."
    options = [row.get("id") for row in _rank(data.get("opportunities"))]
    if not options:
        options = ["read_state", "advance_if_gates_pass", "IDLE / MONITOR"]
    record = {
        "objective": objective,
        "evidence": list(facts["verified_facts"]),
        "constraints": [
            "Assumptions are not facts.",
            "Spend, send, deploy, and AgentZ --mode auto are denied.",
            f"Launch stage is {state.get('current_stage')}.",
        ],
        "options": options,
        "expected_outcome": "The launch stage changes only if the existing gates pass and the caller approved the advance.",
        "cost": None if choice is None else choice.get("cost"),
        "risk": None if choice is None else choice.get("risk"),
        "reversibility": None if choice is None else choice.get("reversibility"),
        "probability": None if choice is None else choice.get("probability"),
        "decision": decision or (None if choice is None else choice.get("action")),
        "reason": reason or "The highest rankable opportunity that fits the resources is the candidate.",
    }
    if set(record) != set(DECISION_FIELDS):
        raise RuntimeError("decision fields drifted")
    return record


def _verification(
    executed: bool,
    changed: bool,
    independent: bool,
    evidence: list[str],
    economics: Mapping[str, Any],
) -> dict[str, Any]:
    clean_evidence = [item for item in evidence if isinstance(item, str) and item.strip()]
    success = bool(executed and changed and independent and clean_evidence)
    return {
        "executed": executed,
        "external_state_changed": changed,
        "independently_verifiable": independent,
        "evidence": clean_evidence,
        "economic_outcome": dict(economics),
        "success": success,
    }


def _authority_requested(data: Mapping[str, Any]) -> bool:
    requested = data.get("requested_authority")
    items: list[Any]
    if isinstance(requested, str):
        items = [requested]
    elif isinstance(requested, list):
        items = requested
    else:
        items = []
    for item in items:
        if isinstance(item, str) and item.strip().lower() in _DENIED_REQUESTS:
            return True
    mode = data.get("mode")
    return isinstance(mode, str) and mode.strip().lower() in _DENIED_REQUESTS


def _decision_id(data: Mapping[str, Any], action: str, gate_context: Mapping[str, Any]) -> str:
    supplied = data.get("decision_id")
    if isinstance(supplied, str) and supplied.strip():
        return supplied.strip()
    payload = json.dumps({"action": action, "gate_context": gate_context}, sort_keys=True, default=str)
    return payload


def _next_stage(stage: LaunchStage) -> LaunchStage | None:
    index = STAGE_ORDER.index(stage)
    if index >= len(STAGE_ORDER) - 1:
        return None
    return STAGE_ORDER[index + 1]


def _blank_recommendations() -> dict[str, Any]:
    return {
        "works": None,
        "does_not_work": None,
        "costs_too_much": None,
        "most_value": None,
        "automate": None,
        "stop": None,
        "escalate": None,
    }


def _row_id(row: Mapping[str, Any]) -> str | None:
    value = row.get("id")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _unique_ids(ids: list[str]) -> list[str] | None:
    seen: list[str] = []
    for item in ids:
        if item not in seen:
            seen.append(item)
    return seen or None


def _recommendations(rows: list[Mapping[str, Any]]) -> dict[str, Any]:
    """Answers from supplied rows. One success is not an automation."""
    works: list[str] = []
    does_not: list[str] = []
    stop: list[str] = []
    escalate: list[str] = []
    success_count: dict[str, int] = {}
    blocked: set[str] = set()
    useful_costs: list[float] = []
    best_cash: float | None = None
    best_id: str | None = None
    for row in rows:
        row_id = _row_id(row)
        if row_id is None:
            continue
        useful = row.get("useful") is True
        verified = row.get("verified") is True
        executed = row.get("executed") is True
        if useful and verified and executed:
            works.append(row_id)
            success_count[row_id] = success_count.get(row_id, 0) + 1
        if row.get("useful") is False or row.get("executed") is False:
            does_not.append(row_id)
        if row.get("mission_violation") is True or row.get("unauthorized") is True:
            stop.append(row_id)
            blocked.add(row_id)
        if row.get("escalated") is True:
            escalate.append(row_id)
        cost = _number(row.get("cost"))
        if useful and cost is not None:
            useful_costs.append(cost)
        cash = _number(row.get("cash_realized"))
        if cash is not None and (best_cash is None or cash > best_cash):
            best_cash = cash
            best_id = row_id
    too_much: list[str] | None = None
    if useful_costs:
        floor = min(useful_costs)
        costly: list[str] = []
        for row in rows:
            row_id = _row_id(row)
            cost = _number(row.get("cost"))
            if row_id is None or cost is None or row.get("useful") is True:
                continue
            if cost > floor:
                costly.append(row_id)
        too_much = _unique_ids(costly)
    automate = _unique_ids([
        row_id for row_id, count in success_count.items() if count >= 3 and row_id not in blocked
    ])
    return {
        "works": _unique_ids(works),
        "does_not_work": _unique_ids(does_not),
        "costs_too_much": too_much,
        "most_value": best_id,
        "automate": automate,
        "stop": _unique_ids(stop),
        "escalate": _unique_ids(escalate),
    }


def _unknown_list() -> dict[str, Any]:
    return {"status": "unknown", "verified": False, "items": []}


def _supplied_ids(opportunities: Any) -> dict[str, Any]:
    """Opportunity ids are caller input. They are not verified facts."""
    if not isinstance(opportunities, list):
        return _unknown_list()
    items = [
        str(item["id"])
        for item in opportunities
        if isinstance(item, Mapping) and item.get("id")
    ]
    if not items:
        return _unknown_list()
    return {"status": "supplied", "verified": False, "items": items}


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, (list, tuple)):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return []


def _one_text(value: Any) -> str:
    if isinstance(value, str):
        return " ".join(value.split())
    return ""
