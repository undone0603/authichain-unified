"""
agentz.workflows.handlers.cloudflare_email_routing
--------------------------------------------------
Autonomous Browser task to configure Cloudflare Email Routing.
Redirects Z@authichain.com -> authichain@gmail.com
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.browser import run_browser_task

TASK_PROMPT = """
1. Open https://dash.cloudflare.com/4c1869b90f13f86940aa3747839bf420/authichain.com/email/routing/routes
2. If login is required, look for "Continue with Google" or similar.
3. Once on the Email Routing page:
   a. Click "Create address" or "Add custom address".
   b. Set Custom address to: Z
   c. Set Destination address to: authichain@gmail.com
   d. Click "Save" or "Add".
4. If a destination verification is required, note it in the output.
5. Confirm the rule is active.
"""

def run(ctx: ExecutionContext) -> Optional[str]:
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("Open Cloudflare Dashboard for authichain.com")
        ctx.step("Navigate to Email Routing")
        ctx.step("Create rule: Z@authichain.com -> authichain@gmail.com")
        return "dry-run complete"
        
    ctx.step("Launching browser agent to configure Email Routing...")
    try:
        # We use our hardened run_browser_task which handles LLM failover and context management
        res = asyncio.run(run_browser_task(TASK_PROMPT, ctx))
        return f"Cloudflare Email Routing configuration attempted. Result: {res}"
    except Exception as e:
        return f"Failed to configure Email Routing: {e}"
