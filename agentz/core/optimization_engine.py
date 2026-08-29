"""
agentz.core.optimization_engine
-------------------------------
Orchestrator for automated campaign optimization.
"""
import logging
from agentz.core.analytics import calculate_conversion_rates, should_pivot
from agentz.core.marketing import pivot_template

logger = logging.getLogger("agentz.optimization")

async def automate_campaign_pivot(vertical: str):
    """
    Checks A/B test results and autonomously pivots the campaign if a winner is statistically significant.
    """
    logger.info(f"Running automated campaign optimization for {vertical}...")
    
    stats = calculate_conversion_rates()
    
    if await should_pivot(stats):
        # Identify the winner
        p = stats.get("personalized", {"conv": 0})
        g = stats.get("generic", {"conv": 0})
        
        winner_hook = "personalized hook" if p["conv"] > g["conv"] else "generic hook"
        
        logger.info(f"Pivot triggered! Winner: {winner_hook}")
        
        # In a real implementation, we would pass the actual hook text from the logs, 
        # not just the variant name.
        
        await pivot_template(f"Refined hook based on {winner_hook} variant", vertical)
        logger.info("Successfully pivoted outreach template.")
    else:
        logger.info("Campaign metrics not yet met for pivoting.")
