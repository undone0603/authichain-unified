"""
agentz.workflows.handlers.launch.revenue_review
------------------------------------------------
RevenueOperator: review unit economics and allocate budget.

Tracks:
  CAC, lead→meeting, meeting→pilot, pilot→paid,
  revenue/product, revenue/scan, revenue/customer,
  gross margin, API usage cost, AI cost, infrastructure cost.

Decides where the next dollar of effort should go.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext
from agentz.core.specialists import RevenueOperator


def run(ctx: ExecutionContext) -> str:
    """Review economics and recommend budget allocation."""
    ctx.step("RevenueOperator: reviewing economics")

    operator = RevenueOperator()
    result = operator.assess({
        "stage": "BETA_READY",  # would come from state machine
        "revenue_mtd": 0.0,
        "cac": 0.0,
        "pilot_to_paid_rate": 0.0,
        "gross_margin": 0.0,
        "ai_cost_mtd": 0.0,
        "infra_cost_mtd": 0.0,
    })

    if ctx.verbose:
        for finding in result.findings:
            print(f"  - {finding}")
        for action in result.recommended_actions:
            print(f"  → {action}")

    return (
        f"REVENUE_REVIEW: {len(result.findings)} findings, "
        f"{len(result.recommended_actions)} recommendations. "
        f"{'; '.join(result.findings) or 'All metrics nominal'}"
    )
