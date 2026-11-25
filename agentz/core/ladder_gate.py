# AgentZ port of AI Adapt research build 2026-10-28 LadderGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-28-laddergate-effort-escalation.md
"""LadderGate — escalate-on-verified-failure for agent/extraction calls.

Technique: arXiv:2610.34491 (Sun et al., Together AI) — start at the lowest
reasoning-effort tier and escalate ONLY after a verified failure, instead of
paying for top effort on every call. Verifier slot is pluggable: schema checks,
a correctness scorer such as MiniCPM-OCR Jev (hf:openbmb/MiniCPM-OCR-Jev,
Apache-2.0, returns a 0-1 correctness score), or both.
Reimplemented from the paper's description; no code copied (upstream is MIT anyway).
"""
from __future__ import annotations
import hashlib, json, time
from dataclasses import dataclass, field, asdict
from typing import Any, Callable, Optional

@dataclass(frozen=True)
class Tier:
    name: str                 # e.g. "low", "medium", "high"
    effort: str               # value passed to the model's effort setting
    usd_per_call_est: float   # ESTIMATE used for the ledger

@dataclass
class Attempt:
    tier: str
    ok: bool
    score: Optional[float]
    reasons: list
    cost_est: float
    output_sha256: str

@dataclass
class Result:
    status: str               # "accepted" | "human_review"
    output: Any
    tier: Optional[str]
    attempts: list = field(default_factory=list)
    total_cost_est: float = 0.0
    def receipt(self) -> dict:
        d = asdict(self); d.pop("output"); return d

Caller = Callable[[str, dict], Any]          # (effort, task) -> output
Verifier = Callable[[dict, Any], tuple]      # (task, output) -> (ok, score|None, reasons)

def _sha(o: Any) -> str:
    return hashlib.sha256(json.dumps(o, sort_keys=True, default=str).encode()).hexdigest()

def run_ladder(task: dict, call: Caller, verify: Verifier, tiers: list[Tier]) -> Result:
    """Try tiers cheapest-first; return first verified output. Never returns an
    unverified output as accepted — exhausting the ladder routes to human review."""
    if not tiers:
        raise ValueError("at least one tier required")
    res = Result(status="human_review", output=None, tier=None)
    for t in tiers:
        try:
            out = call(t.effort, task)
            ok, score, reasons = verify(task, out)
        except Exception as e:  # a crashed call is a verified failure, not a pass
            out, ok, score, reasons = None, False, None, [f"error:{type(e).__name__}"]
        res.attempts.append(Attempt(t.name, ok, score, list(reasons), t.usd_per_call_est, _sha(out)))
        res.total_cost_est = round(res.total_cost_est + t.usd_per_call_est, 6)
        if ok:
            res.status, res.output, res.tier = "accepted", out, t.name
            return res
    return res

# ---- Battery Passport verifier (schema + optional correctness scorer) -------
REQUIRED = {"manufacturer_id": str, "battery_category": str,
            "rated_capacity_ah": (int, float), "chemistry": str}
CATEGORIES = {"portable", "LMT", "SLI", "industrial", "EV"}

def passport_verifier(scorer: Optional[Callable[[dict, Any], float]] = None,
                      threshold: float = 0.8) -> Verifier:
    def verify(task: dict, out: Any):
        reasons = []
        if not isinstance(out, dict):
            return False, None, ["not_a_dict"]
        for k, typ in REQUIRED.items():
            if k not in out or out[k] in (None, ""):
                reasons.append(f"missing:{k}")
            elif not isinstance(out[k], typ) or isinstance(out[k], bool):
                reasons.append(f"type:{k}")
        if out.get("battery_category") not in CATEGORIES and "missing:battery_category" not in reasons:
            reasons.append("enum:battery_category")
        cap = out.get("rated_capacity_ah")
        if isinstance(cap, (int, float)) and not isinstance(cap, bool) and cap <= 0:
            reasons.append("range:rated_capacity_ah")
        score = None
        if scorer is not None and not reasons:
            score = float(scorer(task, out))
            if score < threshold:
                reasons.append(f"score<{threshold}")
        return (not reasons), score, reasons
    return verify

DEFAULT_TIERS = [Tier("low", "low", 0.002), Tier("medium", "medium", 0.01), Tier("high", "high", 0.06)]
