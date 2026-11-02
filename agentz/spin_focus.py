"""SPIN focus-of-focus: bounded, deterministic inspection of proposed attention.

No agent, tool, or command is executed. The scoring is an explicit decision aid,
not a measure or demonstration of consciousness. Values are observer-supplied.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math

from agentz.spin_experiment import SpinFrame, verify_frame

MAX_ATTENTION_CANDIDATES = 12


@dataclass(frozen=True)
class FocusCandidate:
    intent_index: int
    relevance: float
    novelty: float

    def __post_init__(self) -> None:
        if self.intent_index < 0:
            raise ValueError("intent_index must be nonnegative")
        for value in (self.relevance, self.novelty):
            if not math.isfinite(value) or not (0 <= value <= 1):
                raise ValueError("focus ratings must be finite values in [0,1]")


@dataclass(frozen=True)
class FocusReview:
    frame_digest: str
    objective: str
    selected_index: int | None
    selected_score: float
    attention_drift: float
    held_indices: tuple[int, ...]
    insufficient_evidence: tuple[int, ...]
    decision: str
    digest: str
    consciousness_claim: str = "not_assessed"


def review_digest(review: FocusReview) -> str:
    body = {
        "frame_digest": review.frame_digest,
        "objective": review.objective,
        "selected_index": review.selected_index,
        "selected_score": review.selected_score,
        "attention_drift": review.attention_drift,
        "held_indices": list(review.held_indices),
        "insufficient_evidence": list(review.insufficient_evidence),
        "decision": review.decision,
        "consciousness_claim": review.consciousness_claim,
    }
    return hashlib.sha256(
        json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def inspect_own_focus(
    frame: SpinFrame,
    objective: str,
    candidates: tuple[FocusCandidate, ...],
    *,
    minimum_evidence: float = 0.6,
) -> FocusReview:
    """Audit which *proposed* intent most fits a declared objective.

    The relevance and novelty inputs are explicitly supplied, never inferred as
    facts. Quality is bounded by the weakest cited evidence. Held actions are
    excluded from selection. This cannot authorize or execute anything.
    """
    if not verify_frame(frame):
        raise ValueError("SPIN frame digest mismatch")
    if not 1 <= len(objective.strip()) <= 240:
        raise ValueError("objective must be nonempty and bounded")
    if not 1 <= len(candidates) <= MAX_ATTENTION_CANDIDATES:
        raise ValueError("focus requires 1..12 candidates")
    if not math.isfinite(minimum_evidence) or not 0 <= minimum_evidence <= 1:
        raise ValueError("invalid evidence threshold")
    indices = [c.intent_index for c in candidates]
    if len(indices) != len(set(indices)) or max(indices) >= len(frame.intents):
        raise ValueError("focus candidates must reference distinct intents")
    confidence_by_ref = {e.ref: e.confidence for e in frame.evidence}
    held: list[int] = []
    insufficient: list[int] = []
    eligible: list[tuple[float, float, int]] = []
    for candidate in candidates:
        intent = frame.intents[candidate.intent_index]
        if intent.status != "proposed_only":
            held.append(candidate.intent_index)
            continue
        weakest = min(confidence_by_ref[r] for r in intent.evidence_refs)
        if weakest < minimum_evidence:
            insufficient.append(candidate.intent_index)
            continue
        # Prefer objective alignment to novelty. A distraction is the novelty
        # exceeding relevance; it *reduces* priority, not increases it.
        distraction = max(0.0, candidate.novelty - candidate.relevance)
        score = round(candidate.relevance * weakest * (1 - distraction), 6)
        eligible.append((score, candidate.relevance, candidate.intent_index))
    # Deterministic tie breaking: higher score, higher relevance, lower index.
    eligible.sort(key=lambda x: (-x[0], -x[1], x[2]))
    best = eligible[0] if eligible else None
    selected = best[2] if best else None
    selected_score = best[0] if best else 0.0
    avg_relevance = sum(c.relevance for c in candidates) / len(candidates)
    drift = round(1 - avg_relevance, 6)
    decision = "proposed_only" if best else "no_eligible_proposal"
    initial = FocusReview(
        frame_digest=frame.digest,
        objective=objective.strip(),
        selected_index=selected,
        selected_score=selected_score,
        attention_drift=drift,
        held_indices=tuple(sorted(held)),
        insufficient_evidence=tuple(sorted(insufficient)),
        decision=decision,
        digest="",
    )
    return FocusReview(**{**initial.__dict__, "digest": review_digest(initial)})


def inspect_focus_review(frame: SpinFrame, review: FocusReview) -> str:
    """Second-order check of a focus decision; never upgrades permissions."""
    if not verify_frame(frame) or review.frame_digest != frame.digest:
        return "invalid_frame"
    if review_digest(review) != review.digest:
        return "tampered_review"
    if review.selected_index is None:
        return "no_executable_action"
    if frame.intents[review.selected_index].status != "proposed_only":
        return "operator_hold"
    return "proposal_only_no_execution"
