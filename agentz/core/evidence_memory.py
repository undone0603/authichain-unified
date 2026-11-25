# AgentZ port of AI Adapt research build 2026-11-11 EvidenceMemory (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-11-evidencememory-linked-lessons.md
"""EvidenceMemory: agent lessons that stay linked to the run that taught them.

Method from WikiTrace (arXiv:2611.14320, code Apache-2.0); written fresh here.
Each lesson stores (1) a short insight, (2) a why-it-worked/failed summary and
(3) a content hash of the raw trajectory. Before acting, the agent gets every
insight, and a lesson is sent for evidence review ("descend") when it came from
a failed run, conflicts with another lesson on the same key, or lacks a slot the
task needs. Added for AuthiChain: the trajectory hash is re-checked on descent,
so edited or missing evidence quarantines the lesson instead of trusting it.
"""
from __future__ import annotations
import hashlib, json
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional


def sha256_json(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


@dataclass
class Lesson:
    id: str
    key: str                      # what the lesson is about, e.g. "bp.field.carbon_footprint"
    insight: str                  # the action advice
    outcome: str                  # "success" | "failure"
    why: str                      # summary of why the run succeeded/failed
    trajectory_ref: str           # where the raw trajectory lives
    trajectory_sha256: str
    slots: Dict[str, str] = field(default_factory=dict)  # concrete details, e.g. {"unit": "kgCO2e/kWh"}


@dataclass
class Review:
    lesson_id: str
    status: str          # TRUSTED | REVIEWED | CORRECTED | QUARANTINED
    reasons: List[str]
    insight: str


class EvidenceMemory:
    def __init__(self, load_trajectory: Callable[[str], object]):
        self._lessons: Dict[str, Lesson] = {}
        self._load = load_trajectory

    def add(self, lesson_id, key, insight, outcome, why, trajectory_ref, trajectory, slots=None) -> Lesson:
        if outcome not in ("success", "failure"):
            raise ValueError("outcome must be success or failure")
        l = Lesson(lesson_id, key, insight, outcome, why, trajectory_ref, sha256_json(trajectory), dict(slots or {}))
        self._lessons[lesson_id] = l
        return l

    def lessons(self) -> List[Lesson]:
        return list(self._lessons.values())

    def descent_reasons(self, lesson: Lesson, required_slots: Iterable[str]) -> List[str]:
        reasons = []
        if lesson.outcome == "failure":
            reasons.append("from_failed_run")
        if any(o.id != lesson.id and o.key == lesson.key and o.insight != lesson.insight for o in self._lessons.values()):
            reasons.append("conflicts")
        missing = [s for s in required_slots if s not in lesson.slots]
        if missing:
            reasons.append("missing:" + ",".join(sorted(missing)))
        return reasons

    def prepare(self, required_slots: Iterable[str] = (),
                corrector: Optional[Callable[[Lesson, object, List[str]], Optional[str]]] = None) -> List[Review]:
        """Review every lesson before an agent acts. corrector(lesson, trajectory, reasons)
        returns a corrected insight, or None to keep it. In production it is an LLM call."""
        required = list(required_slots)
        out = []
        for l in sorted(self._lessons.values(), key=lambda x: x.id):
            reasons = self.descent_reasons(l, required)
            if not reasons:
                out.append(Review(l.id, "TRUSTED", [], l.insight))
                continue
            try:
                traj = self._load(l.trajectory_ref)
            except Exception as exc:
                out.append(Review(l.id, "QUARANTINED", reasons + [f"evidence_unavailable:{type(exc).__name__}"], l.insight))
                continue
            if sha256_json(traj) != l.trajectory_sha256:
                out.append(Review(l.id, "QUARANTINED", reasons + ["evidence_hash_mismatch"], l.insight))
                continue
            fixed = corrector(l, traj, reasons) if corrector else None
            if fixed and fixed != l.insight:
                out.append(Review(l.id, "CORRECTED", reasons, fixed))
            else:
                out.append(Review(l.id, "REVIEWED", reasons, l.insight))
        return out

    @staticmethod
    def context(reviews: List[Review]) -> str:
        """Prompt block: quarantined lessons are left out."""
        lines = [f"- [{r.status}] {r.insight}" for r in reviews if r.status != "QUARANTINED"]
        return "Lessons (checked against their source runs):\n" + "\n".join(lines)
