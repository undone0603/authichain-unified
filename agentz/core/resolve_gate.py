# AgentZ port of AI Adapt research build 2026-11-19 ResolveGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-19-resolvegate-noise-aware-selection.md
"""ResolveGate: accept an agent artifact change only when the improvement is
resolvable above run-to-run noise.

Built from the method in "The Resolution Hypothesis" (arXiv:2611.23068), which
finds selection between candidate prompts/skills/memories is often no better
than random because score margins sit inside the noise of repeated runs.
Method only (no code released); this is an original implementation.

Inputs are per-item scores (0..1) on a FIXED eval set, from >=2 replicate runs
of the champion and of the candidate. Decision:
  ACCEPT        lower bound of paired-bootstrap CI on mean(candidate-champion)
                exceeds the champion's own replicate noise floor
  REJECT        upper bound of that CI is below zero (candidate is worse)
  INCONCLUSIVE  anything else -> keep the champion, gather more items/runs
"""
from __future__ import annotations
import hashlib, json, random, statistics
from dataclasses import dataclass, field

ACCEPT, REJECT, INCONCLUSIVE = "ACCEPT", "REJECT", "INCONCLUSIVE"

def item_means(runs):
    n = len(runs[0])
    if any(len(r) != n for r in runs):
        raise ValueError("all runs must score the same items")
    return [statistics.fmean(r[i] for r in runs) for i in range(n)]

def noise_floor(runs):
    """Mean absolute gap in overall score between any two replicate runs."""
    if len(runs) < 2:
        raise ValueError("need >=2 replicate runs to measure noise")
    totals = [statistics.fmean(r) for r in runs]
    gaps = [abs(a - b) for i, a in enumerate(totals) for b in totals[i + 1:]]
    return statistics.fmean(gaps)

def paired_bootstrap_ci(diffs, iters=2000, alpha=0.05, seed=0):
    rng = random.Random(seed)
    n = len(diffs)
    means = sorted(statistics.fmean(diffs[rng.randrange(n)] for _ in range(n)) for _ in range(iters))
    lo = means[int((alpha / 2) * iters)]
    hi = means[int((1 - alpha / 2) * iters) - 1]
    return lo, hi

def sign_test_p(diffs):
    """Two-sided exact sign test on non-zero paired differences."""
    pos = sum(d > 0 for d in diffs); neg = sum(d < 0 for d in diffs)
    n = pos + neg
    if n == 0:
        return 1.0
    k = min(pos, neg)
    from math import comb
    p = sum(comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * p)

@dataclass
class Decision:
    verdict: str
    delta: float
    ci: tuple
    noise: float
    sign_p: float
    n_items: int
    reason: str

def decide(champion_runs, candidate_runs, min_items=30, seed=0) -> Decision:
    a, b = item_means(champion_runs), item_means(candidate_runs)
    if len(a) != len(b):
        raise ValueError("champion and candidate must score the same items")
    diffs = [y - x for x, y in zip(a, b)]
    delta = statistics.fmean(diffs)
    noise = noise_floor(champion_runs)
    lo, hi = paired_bootstrap_ci(diffs, seed=seed)
    p = sign_test_p(diffs)
    if len(diffs) < min_items:
        return Decision(INCONCLUSIVE, delta, (lo, hi), noise, p, len(diffs), f"only {len(diffs)} items; need {min_items}")
    if lo > noise:
        return Decision(ACCEPT, delta, (lo, hi), noise, p, len(diffs), "CI lower bound clears noise floor")
    if hi < 0:
        return Decision(REJECT, delta, (lo, hi), noise, p, len(diffs), "candidate worse with confidence")
    return Decision(INCONCLUSIVE, delta, (lo, hi), noise, p, len(diffs), "gain not resolvable above noise")

def rank_methods(results: dict, seed=0):
    """results: name -> list of replicate runs. Returns tiers; methods in the
    same tier are not separable at this resolution."""
    names = sorted(results, key=lambda k: -statistics.fmean(statistics.fmean(r) for r in results[k]))
    tiers = [[names[0]]]
    for name in names[1:]:
        lead = tiers[-1][0]
        d = decide(results[name], results[lead], min_items=1, seed=seed)
        if d.verdict == ACCEPT:          # leader resolvably beats this one -> new tier
            tiers.append([])
        tiers[-1].append(name)
    return tiers

@dataclass
class Champion:
    artifact_id: str
    runs: list
    ledger: list = field(default_factory=list)

    def propose(self, artifact_id, runs, seed=0) -> Decision:
        d = decide(self.runs, runs, seed=seed)
        prev = self.ledger[-1]["sha256"] if self.ledger else ""
        row = {"champion": self.artifact_id, "candidate": artifact_id, "verdict": d.verdict,
               "delta": round(d.delta, 6), "ci": [round(d.ci[0], 6), round(d.ci[1], 6)],
               "noise": round(d.noise, 6), "prev": prev}
        row["sha256"] = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()
        self.ledger.append(row)
        if d.verdict == ACCEPT:
            self.artifact_id, self.runs = artifact_id, runs
        return d
