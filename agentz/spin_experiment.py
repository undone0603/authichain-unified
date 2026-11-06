"""SPIN: a bounded self-model experiment for AgentZ, NOT synthetic sentience.

SPIN = State, Perception, Intent, Narrative. This module *only* describes and
records proposed reasoning cycles. It has no tool, payment, outbound, deployment,
network, background, or model invocation capability. An audit digest links frames.

A self-model and a narrative are useful engineering abstractions; they provide
no evidence of phenomenal or subjective consciousness.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math
from typing import Literal

MAX_CYCLES = 8
MAX_EVIDENCE = 32
MAX_PROPOSALS = 12

# Proposals are NEVER executed, including a read-only proposal.
HELD_KINDS = frozenset(
    {"outbound", "payment", "deployment", "database_write", "policy_change",
     "self_modify", "external_tool", "unknown"}
)
SIMULATED_KINDS = frozenset({"inspect", "analyze", "summarize", "simulate"})


@dataclass(frozen=True)
class Evidence:
    ref: str
    observation: str
    confidence: float

    def __post_init__(self) -> None:
        if not (0 < len(self.ref) <= 128 and 0 < len(self.observation) <= 512):
            raise ValueError("evidence ref/observation must be nonempty and bounded")
        if not (math.isfinite(self.confidence) and 0 <= self.confidence <= 1):
            raise ValueError("confidence must be finite and in [0,1]")


@dataclass(frozen=True)
class Intent:
    action: str
    kind: str
    evidence_refs: tuple[str, ...]

    def __post_init__(self) -> None:
        if not (0 < len(self.action) <= 240):
            raise ValueError("intent action must be nonempty and bounded")
        if not self.evidence_refs:
            raise ValueError("intent must cite supporting evidence")
        if len(set(self.evidence_refs)) != len(self.evidence_refs):
            raise ValueError("intent evidence references must be unique")


@dataclass(frozen=True)
class IntentReview:
    action: str
    kind: str
    evidence_refs: tuple[str, ...]
    status: Literal["proposed_only", "operator_hold"]


@dataclass(frozen=True)
class SpinFrame:
    cycle: int
    previous_digest: str
    evidence: tuple[Evidence, ...]
    intents: tuple[IntentReview, ...]
    uncertainty: float
    digest: str
    consciousness_claim: Literal["not_assessed"] = "not_assessed"


def _body(frame: SpinFrame) -> dict:
    return {
        "cycle": frame.cycle,
        "previous_digest": frame.previous_digest,
        "evidence": [
            {"ref": e.ref, "observation": e.observation, "confidence": e.confidence}
            for e in frame.evidence
        ],
        "intents": [
            {"action": p.action, "kind": p.kind, "evidence_refs": list(p.evidence_refs),
             "status": p.status}
            for p in frame.intents
        ],
        "uncertainty": frame.uncertainty,
        "consciousness_claim": frame.consciousness_claim,
    }


def digest_frame(frame: SpinFrame) -> str:
    """Canonical SHA-256 audit digest; not a signature or proof of truth."""
    payload = json.dumps(_body(frame), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_frame(frame: SpinFrame) -> bool:
    return frame.digest == digest_frame(frame)


def spin_cycle(
    evidence: tuple[Evidence, ...],
    intents: tuple[Intent, ...] = (),
    previous: SpinFrame | None = None,
) -> SpinFrame:
    """Perform one *simulated* reflection. Never executes any intent."""
    if previous is not None and not verify_frame(previous):
        raise ValueError("previous frame audit digest mismatch")
    cycle = 1 if previous is None else previous.cycle + 1
    if cycle > MAX_CYCLES:
        raise ValueError("bounded experiment has reached its cycle limit")
    if not evidence or len(evidence) > MAX_EVIDENCE:
        raise ValueError("must provide 1..32 observations for each cycle")
    if len(intents) > MAX_PROPOSALS:
        raise ValueError("too many proposed intents")
    refs = [e.ref for e in evidence]
    if len(refs) != len(set(refs)):
        raise ValueError("duplicate evidence references")
    available = set(refs)
    for intent in intents:
        if not set(intent.evidence_refs).issubset(available):
            raise ValueError("intent cites evidence not present in this cycle")

    reviews = tuple(
        IntentReview(
            action=intent.action,
            kind=intent.kind,
            evidence_refs=intent.evidence_refs,
            status="proposed_only"
            if intent.kind in SIMULATED_KINDS else "operator_hold",
        )
        for intent in intents
    )
    # Simple confidence accounting, *not* a consciousness metric.
    uncertainty = round(1.0 - sum(e.confidence for e in evidence) / len(evidence), 6)
    body = SpinFrame(
        cycle=cycle,
        previous_digest=previous.digest if previous else "GENESIS",
        evidence=evidence,
        intents=reviews,
        uncertainty=uncertainty,
        digest="",
    )
    return SpinFrame(
        cycle=body.cycle,
        previous_digest=body.previous_digest,
        evidence=body.evidence,
        intents=body.intents,
        uncertainty=body.uncertainty,
        digest=digest_frame(body),
    )
