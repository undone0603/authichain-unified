# AgentZ port of AI Adapt research build 2026-11-06 EvalSlice (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-06-evalslice-eval-compression.md
"""EvalSlice — stable, low-cost eval-set compression (best-of-random subsets).

Method from BestRand (arXiv:2611.00883, CMU; reference code MIT at
github.com/George-Ling3/BestRand). Written fresh here; no code copied.

Problem: running every candidate model on a full eval set is slow and costly.
A random k-item subset usually estimates the full score well, but the error
distribution is long-tailed: a few subsets are badly wrong. EvalSlice draws
many random subsets, scores each against models you have already run on the
full set, and keeps the one with the smallest WORST-CASE error, then checks it
on held-out models before you trust it.

Input: a score matrix {model_id: [item_score, ...]} with item scores in [0,1].
Pure Python, deterministic given a seed.
"""
from __future__ import annotations
import random
from dataclasses import dataclass
from statistics import mean
from typing import Dict, List, Sequence

Matrix = Dict[str, Sequence[float]]


@dataclass
class Slice:
    items: List[int]
    max_err: float      # worst |subset mean - full mean| over fit models
    mean_err: float
    holdout_max_err: float | None = None
    trusted: bool | None = None


def _check(matrix: Matrix) -> int:
    if not matrix:
        raise ValueError("empty score matrix")
    lens = {len(v) for v in matrix.values()}
    if len(lens) != 1:
        raise ValueError("models have different item counts")
    n = lens.pop()
    for m, row in matrix.items():
        if any(not (0.0 <= s <= 1.0) for s in row):
            raise ValueError(f"scores for {m} must be in [0,1]")
    return n


def subset_errors(matrix: Matrix, items: Sequence[int]) -> List[float]:
    return [abs(mean(row[i] for i in items) - mean(row)) for row in matrix.values()]


def best_of_random(matrix: Matrix, k: int, draws: int = 500, seed: int = 0) -> Slice:
    n = _check(matrix)
    if not 0 < k <= n:
        raise ValueError("k must be between 1 and the number of items")
    rng = random.Random(seed)
    best = None
    for _ in range(draws):
        items = sorted(rng.sample(range(n), k))
        errs = subset_errors(matrix, items)
        cand = Slice(items, max(errs), mean(errs))
        if best is None or (cand.max_err, cand.mean_err) < (best.max_err, best.mean_err):
            best = cand
    return best


def validate(sl: Slice, holdout: Matrix, tolerance: float) -> Slice:
    """Trust the slice only if it also estimates unseen models within tolerance."""
    _check(holdout)
    sl.holdout_max_err = max(subset_errors(holdout, sl.items))
    sl.trusted = sl.holdout_max_err <= tolerance
    return sl


def estimate(sl: Slice, new_scores_on_slice: Sequence[float]) -> float:
    """Estimate a new model's full-set score from its scores on the slice only."""
    if len(new_scores_on_slice) != len(sl.items):
        raise ValueError("score count must match slice size")
    if sl.trusted is False:
        raise RuntimeError("slice failed holdout validation; run the full set")
    return mean(new_scores_on_slice)


def tail_risk(matrix: Matrix, k: int, threshold: float, draws: int = 500, seed: int = 1) -> float:
    """Share of plain random k-subsets whose worst-model error exceeds threshold."""
    n = _check(matrix)
    rng = random.Random(seed)
    bad = sum(max(subset_errors(matrix, sorted(rng.sample(range(n), k)))) > threshold for _ in range(draws))
    return bad / draws
