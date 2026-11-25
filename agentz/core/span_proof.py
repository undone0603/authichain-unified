# AgentZ port of AI Adapt research build 2026-11-05 SpanProof (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-05-spanproof-checkable-rationale.md
"""SpanProof — statement-checkable rationale gate for authenticity verdicts.

Reimplemented from the method in VeriSpoof (arXiv:2611.04634). No VeriSpoof
code is copied (its code and weights are CC-BY-NC-4.0).

Idea: a model may only issue a verdict whose rationale is made of statements
that a deterministic measurer can check. Each statement names a span, a
metric, an operator and a threshold. The gate re-measures every statement,
derives the verdict from the checked evidence, and rejects a model verdict
that does not follow from its own evidence. Any refuted span marks the item
TAMPERED and is localised, so a partial edit cannot hide behind a mostly
genuine document.
"""
from __future__ import annotations
import json, operator
from dataclasses import dataclass, field
from typing import Callable, Dict, List

OPS: Dict[str, Callable[[float, float], bool]] = {
    "<": operator.lt, "<=": operator.le, ">": operator.gt,
    ">=": operator.ge, "==": operator.eq, "!=": operator.ne,
}
VERIFIED, REFUTED, UNMEASURABLE = "VERIFIED", "REFUTED", "UNMEASURABLE"
AUTHENTIC, TAMPERED, ABSTAIN = "AUTHENTIC", "TAMPERED", "ABSTAIN"


@dataclass(frozen=True)
class Statement:
    span: str
    metric: str
    op: str
    value: float
    text: str = ""


@dataclass
class Report:
    claimed: str
    derived: str
    consistent: bool
    gate: str  # "pass" | "block"
    tampered_spans: List[str] = field(default_factory=list)
    uncovered_spans: List[str] = field(default_factory=list)
    checks: List[dict] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(self.__dict__, sort_keys=True)


Measurer = Callable[[str], float]  # span content -> number


def parse_model_output(raw: str) -> tuple[str, List[Statement]]:
    """Parse the model's JSON: {"verdict": ..., "rationale": [{span, metric, op, value, text}]}."""
    data = json.loads(raw)
    verdict = str(data["verdict"]).upper()
    stmts = []
    for s in data.get("rationale", []):
        if s.get("op") not in OPS:
            raise ValueError(f"unknown operator {s.get('op')!r}")
        stmts.append(Statement(str(s["span"]), str(s["metric"]), s["op"], float(s["value"]), s.get("text", "")))
    return verdict, stmts


def check_statement(st: Statement, spans: Dict[str, str], measurers: Dict[str, Measurer]) -> dict:
    if st.span not in spans or st.metric not in measurers:
        return {"span": st.span, "metric": st.metric, "status": UNMEASURABLE, "measured": None}
    try:
        measured = float(measurers[st.metric](spans[st.span]))
    except Exception as e:  # a measurer failure is never evidence
        return {"span": st.span, "metric": st.metric, "status": UNMEASURABLE, "measured": None, "error": str(e)}
    ok = OPS[st.op](measured, st.value)
    return {"span": st.span, "metric": st.metric, "op": st.op, "value": st.value,
            "measured": measured, "status": VERIFIED if ok else REFUTED}


def derive_verdict(checks: List[dict], spans: Dict[str, str], expectations: List[Statement]) -> tuple[str, List[str], List[str]]:
    """Expectations are the reference rules the model's statements must satisfy.
    A span is tampered when the model's statement on it is refuted by measurement
    OR the measured value breaks a reference expectation."""
    tampered, covered = set(), set()
    for c in checks:
        if c["status"] == REFUTED:
            tampered.add(c["span"])
        elif c["status"] == VERIFIED:
            covered.add(c["span"])
    for c in checks:
        if c["status"] != VERIFIED:
            continue
        for e in expectations:
            if e.metric == c["metric"] and (e.span in ("*", c["span"])) and not OPS[e.op](c["measured"], e.value):
                tampered.add(c["span"])
    uncovered = sorted(set(spans) - covered - tampered)
    if tampered:
        return TAMPERED, sorted(tampered), uncovered
    if uncovered or any(c["status"] == UNMEASURABLE for c in checks) or not checks:
        return ABSTAIN, [], uncovered
    return AUTHENTIC, [], []


def gate(raw_model_output: str, spans: Dict[str, str], measurers: Dict[str, Measurer],
         expectations: List[Statement] = ()) -> Report:
    """Fail-closed: pass only when the derived verdict is AUTHENTIC and the model agrees."""
    try:
        claimed, stmts = parse_model_output(raw_model_output)
    except (ValueError, KeyError, json.JSONDecodeError):
        return Report("UNPARSEABLE", ABSTAIN, False, "block", uncovered_spans=sorted(spans))
    checks = [check_statement(s, spans, measurers) for s in stmts]
    derived, tampered, uncovered = derive_verdict(checks, spans, list(expectations))
    consistent = claimed == derived
    ok = consistent and derived == AUTHENTIC
    return Report(claimed, derived, consistent, "pass" if ok else "block", tampered, uncovered, checks)


def evidence_sensitive(raw: str, spans: Dict[str, str], measurers: Dict[str, Measurer],
                       expectations: List[Statement], span: str, counterfactual: str) -> bool:
    """Counterfactual probe: swap one span's content; the derived verdict must change
    if that span was load-bearing. Returns True when the verdict moved."""
    before = gate(raw, spans, measurers, expectations).derived
    after = gate(raw, {**spans, span: counterfactual}, measurers, expectations).derived
    return before != after
