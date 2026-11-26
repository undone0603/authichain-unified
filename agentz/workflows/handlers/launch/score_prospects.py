"""
agentz.workflows.handlers.launch.score_prospects
-------------------------------------------------
Score discovered prospects on the 100-point rubric:

  ICP fit             0-25
  Pain intensity      0-20
  AuthiChain fit      0-20
  Buying authority   0-15
  Deployment ease    0-10
  Revenue potential  0-10
  ──────────────────────
  TOTAL              100

Only prospects above threshold (60) enter outreach.

Scores only real input. Prospects come from, in order:
  1. ctx.parameters["prospects"]  (list of dicts, e.g. from a run payload)
  2. the CSV at AGENTZ_PROSPECTS_CSV
Each prospect needs a `name` and all six rubric fields. Rows missing a field
are reported as incomplete and never filled in with guesses. With no source,
the handler says so instead of reporting a sample score. Read-only: it reports
and does not write anywhere.
"""
from __future__ import annotations

import csv
import math
import os
from pathlib import Path
from typing import Any

from agentz.core.modes import ExecutionContext
from agentz.core.specialists import GrowthScout

RUBRIC_FIELDS = tuple(GrowthScout.SCORING_RUBRIC)


def _load(ctx: ExecutionContext) -> tuple[list[dict[str, Any]], str]:
    given = (ctx.parameters or {}).get("prospects")
    if isinstance(given, list):
        return [p for p in given if isinstance(p, dict)], "run parameters"
    path = os.environ.get("AGENTZ_PROSPECTS_CSV", "").strip()
    if path and Path(path).is_file():
        with open(path, newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh)), f"CSV {Path(path).name}"
    return [], ""


def _rubric(p: dict[str, Any]) -> dict[str, int] | None:
    out = {}
    for field in RUBRIC_FIELDS:
        raw = p.get(field)
        if raw is None or str(raw).strip() == "":
            return None
        try:
            value = float(str(raw).strip())
            if not math.isfinite(value):
                return None
            out[field] = max(0, int(value))
        except (ValueError, OverflowError):
            return None
    return out


def run(ctx: ExecutionContext) -> str:
    """Score real prospects against the 100-point rubric."""
    ctx.step("GrowthScout: scoring prospects")
    threshold = GrowthScout.PROSPECT_THRESHOLD

    prospects, source = _load(ctx)
    if not source:
        return ("SCORE_PROSPECTS: 0 prospects scored: no prospect source "
                "(pass `prospects` in the run payload or set AGENTZ_PROSPECTS_CSV).")

    scored, incomplete = [], []
    for i, p in enumerate(prospects):
        name = str(p.get("name") or p.get("company") or f"row {i + 1}").strip()
        r = _rubric(p)
        if r is None:
            incomplete.append(name)
            continue
        scored.append((GrowthScout.score_prospect(**r), name))

    scored.sort(key=lambda s: (-s[0], s[1]))
    qualified = [s for s in scored if s[0] >= threshold]
    if ctx.verbose:
        for score, name in scored:
            print(f"  {score:>3}  {name}{'  (qualified)' if score >= threshold else ''}")

    top = ", ".join(f"{name}={score}" for score, name in qualified[:5]) or "none"
    msg = (f"SCORE_PROSPECTS: scored {len(scored)} of {len(prospects)} prospects from {source} "
           f"(threshold={threshold}); {len(qualified)} qualified: {top}.")
    if incomplete:
        msg += f" {len(incomplete)} incomplete (missing rubric fields): {', '.join(incomplete[:5])}."
    return msg
