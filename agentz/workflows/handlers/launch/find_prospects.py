"""
agentz.workflows.handlers.launch.find_prospects
-----------------------------------------------
GrowthScout: discover new prospects (manufacturers, distributors,
product authentication problems, supply-chain digitization initiatives).

Wraps the existing scout module and extends it with the Launch
Governor's scoring rubric.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    """Discover new prospects for the pipeline."""
    ctx.step("GrowthScout: discovering new prospects")

    # In production, this would use browser_use to search directories,
    # industry forums, and partnership databases.
    if ctx.mode == Mode.DRY_RUN:
        return (
            "FIND_PROSPECTS: Would search for manufacturers, distributors, "
            "and product authentication pain points. "
            "Would use the existing scout module + browser-use."
        )

    # Use the existing scout module
    try:
        from agentz.core.scout import scout_businesses
        import asyncio

        # Default search targets: high-value verticals
        cities = ["Detroit", "Grand Rapids", "Ann Arbor"]
        total_found = 0
        for city in cities:
            results = asyncio.run(scout_businesses(city, ctx))
            total_found += len(results)
            if ctx.verbose:
                print(f"  {city}: {len(results)} prospects found")

        return f"FIND_PROSPECTS: Discovered {total_found} new prospects across {len(cities)} cities."
    except Exception as e:
        return f"FIND_PROSPECTS: Error during discovery: {e}"
