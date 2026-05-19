"""
agentz.workflows.handlers.vercel_fix_preset
-------------------------------------------
Browser-use task: change framework preset from Vite -> Other on
authichain-unified-v2 in Vercel dashboard.
"""
from __future__ import annotations

import asyncio

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext, Mode

PROJECT_ID = "prj_mIb6SSMtMy8KsXg9gNta0T3tDJg1"
TEAM_ID    = "team_PKVRDwUXPRFjmGTM7PZxjNys"

TASK_PROMPT = f"""\
Open https://vercel.com/{TEAM_ID}/{PROJECT_ID}/settings/general
If you encounter a login screen, click 'Continue with Email' or 'SSO' and wait for a human if 2FA is required.
Once on the Settings page:
1. Locate the "Build & Development Settings" section.
2. Find the "Framework Preset" dropdown.
3. Change it to "Vite".
4. Click "Save".
5. Navigate to the "Deployments" tab.
6. Trigger a new deployment from the "main" branch.
Wait for the build to start, capture the deployment URL, and exit.
"""


def run(ctx: ExecutionContext) -> str:
    token = get_or_placeholder("vercel_session", ctx)  # noqa: F841 - used implicitly via cookie injection in real run

    if ctx.mode == Mode.DRY_RUN:
        ctx.step("open Vercel dashboard for authichain-unified-v2")
        ctx.step("change Framework Preset -> Vite")
        ctx.step("click Save")
        ctx.step("trigger new deployment from main")
        return "dry-run complete"

    return asyncio.run(_run_browser_task(ctx))


async def _run_browser_task(ctx: ExecutionContext) -> str:
    # Lazy import - keeps dry-run fast and avoids requiring browser-use
    # for handlers that never call it.
    try:
        from browser_use import Agent, Controller  # type: ignore
        from agentz.core.llm import get_llm
        from agentz.core.browser import attach_interceptor, run_with_healing
    except ImportError as e:
        raise RuntimeError(
            "browser-use stack not installed. "
            "Run: pip install browser-use langchain-ollama"
        ) from e

    llm = get_llm(model="gpt-4o", temperature=0.0)
    controller = Controller()
    
    # Enable HITL (Human-In-The-Loop) via AgentZ context
    attach_interceptor(controller, ctx)

    agent = Agent(
        task=TASK_PROMPT,
        llm=llm,
        controller=controller,
    )
    history = await run_with_healing(agent, ctx)
    deployment_url = _extract_url(history)
    return f"deploy triggered: {deployment_url}"


def _extract_url(history) -> str:
    try:
        for entry in reversed(getattr(history, "history", []) or []):
            text = str(entry)
            if "vercel.app" in text:
                start = text.find("https://")
                end   = text.find(" ", start)
                return text[start: end if end > 0 else start + 80]
    except Exception:
        pass
    return "unknown"
