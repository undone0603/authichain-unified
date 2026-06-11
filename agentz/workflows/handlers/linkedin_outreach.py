"""
agentz.workflows.handlers.linkedin_outreach
-------------------------------------------
StrainChain outreach, dynamically optimized by the Intelligence Bridge.
"""
from __future__ import annotations
from agentz.core.credentials import get
from agentz.core.modes import ExecutionContext
from agentz.core.intelligence import optimize_outreach_prompt, get_recent_success_signals
import httpx

DAILY_INVITE_CAP = 18

FIRST_TOUCH = """\
Hi {first_name},

Saw you're running ops at {company} - quick context: I built StrainChain,
a compliance middleware that stamps each batch with a Bitcoin-inscribed
certificate (99/cert, no monthly). It plugs into Metrc and creates
an immutable audit trail regulators can verify in seconds.

Happy to send a 90-second demo video - no call needed. Worth a look?

- Zac
"""

def _count_sent_today():
    # Placeholder for actual Supabase query to count sent invites
    return 0

def run(ctx: ExecutionContext) -> str:
    # 1. Fetch Intelligence
    signals = get_recent_success_signals(limit=5)
    
    # 2. Optimize Template
    optimized_template = optimize_outreach_prompt(FIRST_TOUCH, signals)
    
    # 3. Execution (simplified for demonstration)
    sent_today = ctx.step("Count sent today", action=_count_sent_today) or 0
    remaining = DAILY_INVITE_CAP - sent_today
    
    return f"Prepared outreach using optimized template. Sent: {sent_today}, Remaining: {remaining}"
