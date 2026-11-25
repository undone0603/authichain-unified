# AgentZ port of AI Adapt research build 2026-11-13 RecoveryGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-13-recoverygate-ambiguous-outcomes.md
"""RecoveryGate: evidence-guided recovery for agent actions with ambiguous outcomes.

Reimplemented from the method in "Evidence-Guided Recovery for AI Agents with Ambiguous
Tool Outcomes and Partial Execution" (arXiv:2610.41453). No code was released; written fresh.

Problem: a tool call times out. Did the email send? Did the payment commit? Retrying blindly
can double an effect; giving up can leave the goal unmet. RecoveryGate keeps an effect
history per step, adjudicates each ambiguous step from public evidence (a read-back probe),
checks admissibility of any retry (idempotency key still valid, authorization still fresh,
dependencies done), and ends with a terminal certificate that separates
  GOAL_SATISFIED  - every obligation has evidence it committed
  SAFE_STOP       - nothing left would be unsafe to leave, but the goal is not fully met
  HANDOFF         - at least one step is still UNKNOWN and needs a human
Unknown never silently becomes success.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

COMMITTED, FAILED, UNKNOWN, PENDING = "COMMITTED", "FAILED", "UNKNOWN", "PENDING"


@dataclass
class Capability:
    """What the provider declares it supports for this action."""
    idempotent_key_ttl: float | None = None   # seconds a retry with the same key is deduplicated
    probe: Callable[[str], str | None] | None = None  # read-back: returns COMMITTED/FAILED/None


@dataclass
class Step:
    step_id: str
    action: str
    idem_key: str
    depends_on: list[str] = field(default_factory=list)
    auth_expires_at: float | None = None
    capability: Capability = field(default_factory=Capability)
    status: str = PENDING
    first_attempt_at: float | None = None
    history: list[tuple[float, str, str]] = field(default_factory=list)  # (t, event, detail)


@dataclass
class Decision:
    step_id: str
    move: str      # SKIP_COMMITTED | RETRY | WAIT_DEPS | HANDOFF | EXECUTE
    reason: str


@dataclass
class Certificate:
    verdict: str   # GOAL_SATISFIED | SAFE_STOP | HANDOFF
    committed: list[str]
    failed: list[str]
    unknown: list[str]
    pending: list[str]


class RecoveryGate:
    def __init__(self, steps: list[Step], clock: Callable[[], float]):
        self.steps = {s.step_id: s for s in steps}
        self.clock = clock

    # --- recording -------------------------------------------------------
    def record(self, step_id: str, outcome: str, detail: str = "") -> None:
        s = self.steps[step_id]
        now = self.clock()
        if s.first_attempt_at is None:
            s.first_attempt_at = now
        s.status = {"ok": COMMITTED, "error": FAILED, "timeout": UNKNOWN}[outcome]
        s.history.append((now, outcome, detail))

    # --- adjudication ----------------------------------------------------
    def adjudicate(self, step_id: str) -> str:
        """Resolve an UNKNOWN step from public evidence when the provider offers a probe."""
        s = self.steps[step_id]
        if s.status != UNKNOWN or s.capability.probe is None:
            return s.status
        seen = s.capability.probe(s.idem_key)
        if seen in (COMMITTED, FAILED):
            s.status = seen
            s.history.append((self.clock(), "probe", seen))
        else:
            s.history.append((self.clock(), "probe", "no_evidence"))
        return s.status

    def _retry_admissible(self, s: Step) -> tuple[bool, str]:
        now = self.clock()
        if s.auth_expires_at is not None and now >= s.auth_expires_at:
            return False, "authorization expired"
        ttl = s.capability.idempotent_key_ttl
        if s.status == UNKNOWN:
            if ttl is None:
                return False, "no idempotency guarantee; retry could double the effect"
            if s.first_attempt_at is not None and now - s.first_attempt_at >= ttl:
                return False, "idempotency key expired; retry could double the effect"
        return True, "admissible"

    def next_moves(self) -> list[Decision]:
        out = []
        for s in self.steps.values():
            if s.status == UNKNOWN:
                self.adjudicate(s.step_id)
            if s.status == COMMITTED:
                out.append(Decision(s.step_id, "SKIP_COMMITTED", "evidence of commit"))
                continue
            blocked = [d for d in s.depends_on if self.steps[d].status != COMMITTED]
            if blocked:
                out.append(Decision(s.step_id, "WAIT_DEPS", f"waiting on {','.join(blocked)}"))
                continue
            if s.status == PENDING:
                ok, why = self._retry_admissible(s)
                out.append(Decision(s.step_id, "EXECUTE" if ok else "HANDOFF", why))
                continue
            ok, why = self._retry_admissible(s)
            out.append(Decision(s.step_id, "RETRY" if ok else "HANDOFF", why))
        return out

    # --- terminal certificate -------------------------------------------
    def certificate(self) -> Certificate:
        by = {k: [s.step_id for s in self.steps.values() if s.status == k]
              for k in (COMMITTED, FAILED, UNKNOWN, PENDING)}
        if by[UNKNOWN]:
            verdict = "HANDOFF"
        elif not by[FAILED] and not by[PENDING]:
            verdict = "GOAL_SATISFIED"
        else:
            verdict = "SAFE_STOP"
        return Certificate(verdict, by[COMMITTED], by[FAILED], by[UNKNOWN], by[PENDING])
