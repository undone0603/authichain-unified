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
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext
from agentz.core.specialists import GrowthScout


def run(ctx: ExecutionContext) -> str:
    """Score prospects against the 100-point rubric."""
    ctx.step("GrowthScout: scoring prospects")

    scout = GrowthScout()
    threshold = GrowthScout.PROSPECT_THRESHOLD

    if ctx.verbose:
        print(f"  Scoring rubric: {GrowthScout.SCORING_RUBRIC}")
        print(f"  Outreach threshold: {threshold}")

    # In production, this would load prospects from Supabase and score each.
    # For now, demonstrate the scoring function.
    sample_score = GrowthScout.score_prospect(
        icp_fit=20,
        pain_intensity=18,
        authichain_fit=15,
        buying_authority=10,
        deployment_ease=8,
        revenue_potential=7,
    )

    if ctx.verbose:
        print(f"  Sample prospect score: {sample_score} (threshold: {threshold})")

    qualified = sample_score >= threshold
    return (
        f"SCORE_PROSPECTS: Rubric applied (threshold={threshold}). "
        f"Sample score={sample_score} ({'qualified' if qualified else 'not qualified'}). "
        f"Prospects above {threshold} enter outreach queue."
    )
