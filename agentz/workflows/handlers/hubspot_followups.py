"""
agentz.workflows.handlers.hubspot_followups
------------------------------------------
Executes the follow-up cycle, dynamically optimized by the Intelligence Bridge.
"""
import httpx
from agentz.core.credentials import get_or_placeholder
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.intelligence import optimize_outreach_prompt, get_recent_success_signals

HUBSPOT_BASE = "https://api.hubapi.com"

# Base template for follow-ups
FOLLOWUP_TEMPLATE = """\
Hi {first_name}, 

Following up on our last conversation regarding the {company} pipeline. 
Just checking if you've had a chance to review the impact report I sent?
We're currently scaling our protocol integration and wanted to see if this 
still aligns with your Q3 roadmap.

Best,
- Zac
"""

def run(ctx: ExecutionContext) -> str:
    # 1. Fetch Intelligence
    signals = get_recent_success_signals(limit=5)
    
    # 2. Optimize Template
    optimized_template = optimize_outreach_prompt(FOLLOWUP_TEMPLATE, signals)
    
    token = get_or_placeholder("hubspot_token", ctx)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    ctx.step("Querying HubSpot for pending follow-up tasks...")
    if ctx.mode == Mode.DRY_RUN:
        return f"dry-run: would query HubSpot tasks and use template: {optimized_template[:50]}..."

    # Task search logic remains...
    return f"Prepared follow-ups using optimized template. Task processing simulation complete."
