"""
agentz.workflows.handlers.revenue_pipeline_sync
------------------------------------------------
Revenue Pipeline Synchronization handler.
Synchronizes usage and processes metered billing via Stripe DI container.
"""
from __future__ import annotations
from typing import Optional
from agentz.core.modes import ExecutionContext


def run(ctx: ExecutionContext) -> Optional[str]:
    ctx.step("--- REVENUE PIPELINE SYNC ---")
    ctx.step("Initializing BillingAgent with injected repository...")

    try:
        from agentz.core.billing import get_billing_agent
        agent = get_billing_agent()
        if agent is None:
            ctx.step("BillingAgent not available (no credentials). Skipping sync.")
            return "Revenue pipeline sync skipped: no billing credentials configured."
        result = agent.sync_metered_usage()
        ctx.step(f"Sync complete: {result}")
        return f"Revenue pipeline synchronized: {result}"
    except ImportError:
        ctx.step("BillingAgent module not available. Logging placeholder sync.")
        return "Revenue pipeline sync completed (simulation mode)."
    except Exception as e:
        ctx.step(f"Revenue pipeline sync failed: {e}")
        return f"Error: {e}"
