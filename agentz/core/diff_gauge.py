# AgentZ port of AI Adapt research build 2026-10-30 DiffGauge (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-30-diffgauge-eval-coverage.md
"""DiffGauge — difficulty-coverage audit for eval sets.

Clean-room reimplementation of the measure-over-difficulty view in
arXiv:2610.29927 ("Your Benchmark Is an Empirical Measure Over Difficulty").
The authors' repo ships with NO LICENSE, so no code was copied; this module
is written from the paper's definitions only.

Pipeline:
  1. estimate_difficulty(matrix)  -> Rasch (1PL IRT) item difficulty in [0,1]
  2. ddm(z, target)               -> 1-Wasserstein mismatch vs target (default uniform)
  3. coverage_gaps(z)             -> sorted gaps along the difficulty axis
  4. rank_flip_safe(...)          -> Theorem 2.1 guard: |D_mu| > L * W1 ⇒ no rank flip
  5. benchfill_plan(...)          -> BenchFill-style targets for the k widest gaps,
                                     with an injectable LLM rewriter (mocked in tests)
Pure stdlib. No network.
"""
from __future__ import annotations
import math
from typing import Callable, Dict, List, Optional, Sequence


def _sigmoid(x: float) -> float:
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    e = math.exp(x)
    return e / (1.0 + e)


def estimate_difficulty(matrix: Sequence[Sequence[int]], iters: int = 400,
                        lr: float = 0.05, l2: float = 0.01) -> List[float]:
    """Fit a Rasch model P(correct)=sigmoid(theta_m - b_i) by gradient ascent.

    matrix[m][i] in {0,1}: model m answered item i correctly.
    Returns item difficulties rescaled to [0,1] (higher = harder).
    """
    M = len(matrix)
    if M == 0:
        raise ValueError("empty matrix")
    N = len(matrix[0])
    if any(len(r) != N for r in matrix):
        raise ValueError("ragged matrix")
    theta = [0.0] * M
    b = [0.0] * N
    for _ in range(iters):
        gt = [0.0] * M
        gb = [0.0] * N
        for m in range(M):
            for i in range(N):
                r = matrix[m][i] - _sigmoid(theta[m] - b[i])
                gt[m] += r
                gb[i] -= r
        for m in range(M):
            theta[m] += lr * (gt[m] - l2 * theta[m])
        for i in range(N):
            b[i] += lr * (gb[i] - l2 * b[i])
        mean_b = sum(b) / N  # identifiability: centre item difficulties
        b = [x - mean_b for x in b]
    lo, hi = min(b), max(b)
    if hi - lo < 1e-12:
        return [0.5] * N
    return [(x - lo) / (hi - lo) for x in b]


def ddm(z: Sequence[float], target: Optional[Sequence[float]] = None,
        grid: int = 2000) -> float:
    """Difficulty Distribution Mismatch = W1(nu_B, mu) on [0,1].

    W1 = ∫_0^1 |F_B(t) - F_mu(t)| dt. target=None means Unif[0,1]
    (the paper's maximin default, Thm 2.2); otherwise target is a sample.
    """
    zs = sorted(_check(z))
    ts = sorted(_check(target)) if target is not None else None

    def cdf(sample, t):
        # fraction of points <= t (binary search)
        lo, hi = 0, len(sample)
        while lo < hi:
            mid = (lo + hi) // 2
            if sample[mid] <= t:
                lo = mid + 1
            else:
                hi = mid
        return lo / len(sample)

    total = 0.0
    for k in range(grid):
        t = (k + 0.5) / grid
        fmu = t if ts is None else cdf(ts, t)
        total += abs(cdf(zs, t) - fmu)
    return total / grid


def coverage_gaps(z: Sequence[float], include_bounds: bool = True) -> List[Dict]:
    """Gaps between adjacent difficulty points, widest first."""
    pts = sorted(set(_check(z)))
    if include_bounds:
        pts = sorted(set([0.0] + pts + [1.0]))
    gaps = [{"lo": a, "hi": c, "width": c - a, "mid": (a + c) / 2}
            for a, c in zip(pts, pts[1:])]
    return sorted(gaps, key=lambda g: -g["width"])


def max_gap(z: Sequence[float], include_bounds: bool = True) -> float:
    g = coverage_gaps(z, include_bounds)
    return g[0]["width"] if g else 0.0


def rank_flip_safe(target_diff: float, lipschitz: float, w1: float) -> bool:
    """Theorem 2.1: if |D_mu| > L*W1, the benchmark ordering matches the target."""
    return abs(target_diff) > lipschitz * w1


Rewriter = Callable[[str, float], str]


def benchfill_plan(z: Sequence[float], items: Sequence[str], k: int = 3,
                   rewriter: Optional[Rewriter] = None) -> List[Dict]:
    """For the k widest gaps, pick the seed item nearest the gap midpoint and
    (optionally) ask a rewriter to produce a new item at that difficulty.
    New items MUST be re-scored before they count — this only proposes."""
    zl = _check(z)
    if len(zl) != len(items):
        raise ValueError("z and items length mismatch")
    plan = []
    for g in coverage_gaps(zl)[:k]:
        seed = min(range(len(zl)), key=lambda i: abs(zl[i] - g["mid"]))
        entry = {"target_difficulty": round(g["mid"], 4), "gap_width": round(g["width"], 4),
                 "seed_index": seed, "seed_item": items[seed], "proposed_item": None,
                 "status": "PROPOSED"}
        if rewriter is not None:
            entry["proposed_item"] = rewriter(items[seed], g["mid"])
        plan.append(entry)
    return plan


def audit(matrix: Sequence[Sequence[int]], items: Sequence[str], k: int = 3,
          target: Optional[Sequence[float]] = None,
          rewriter: Optional[Rewriter] = None) -> Dict:
    z = estimate_difficulty(matrix)
    w1 = ddm(z, target)
    return {"n_items": len(z), "difficulty": [round(x, 4) for x in z],
            "ddm_w1": round(w1, 4), "max_gap": round(max_gap(z), 4),
            "top_gaps": coverage_gaps(z)[:k],
            "benchfill": benchfill_plan(z, items, k, rewriter)}


def _check(z):
    zl = list(z)
    if not zl:
        raise ValueError("empty difficulty list")
    for x in zl:
        if not (0.0 <= x <= 1.0):
            raise ValueError(f"difficulty {x} outside [0,1]")
    return zl

