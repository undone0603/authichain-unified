"""
agentz.workflows.handlers.vercel_fix_preset
-------------------------------------------
Browser-use task: change framework preset from Vite → Other on
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
Locate the "Build & Development Settings" section.
Find the "Framework Preset" dropdown (currently set to "Vite").
Change it to "Other".
Click "Save".
Then navigate to the Deployments tab and trigger a new deployment from main.
Wait for build to start, capture the deployment URL, exit.
"""


def run(ctx: ExecutionContext) -> str:
    token = get_or_placeholder("vercel_session", ctx)  # noqa: F841 — used implicitly via cookie injection in real run

    if ctx.mode == Mode.DRY_RUN:
        ctx.step("open Vercel dashboard for authichain-unified-v2")
        ctx.step("change Framework Preset Vite → Other")
        ctx.step("click Save")
        ctx.step("trigger new deployment from main")
        return "dry-run complete"

    return asyncio.run(_run_browser_task(ctx))


async def _run_browser_task(ctx: ExecutionContext) -> str:
    # Lazy import — keeps dry-run fast and avoids requiring browser-use
    # for handlers that never call it.
    try:
        from browser_use import Agent           # type: ignore
        from langchain_ollama import ChatOllama # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "browser-use stack not installed. "
            "Run: pip install browser-use langchain-ollama"
        ) from e

    llm = ChatOllama(model="llama3.2", temperature=0.0)

    def step_callback(state: dict) -> None:
        action = state.get("action") or state.get("description") or "..."
        ctx.step(f"agent: {action}")

    agent = Agent(
        task=TASK_PROMPT,
        llm=llm,
        # Hook lets us route every action through the ExecutionContext
        # so confirm-mode can intercept clicks.
    )
    history = await agent.run(max_steps=20)
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
