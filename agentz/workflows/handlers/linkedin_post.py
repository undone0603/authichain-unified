"""
agentz.workflows.handlers.linkedin_post
--------------------------------------
Posts to LinkedIn via the browser session (li_at + JSESSIONID).
Accepts payload.linkedin / payload.text or payload.bundle under content/social/.
"""
from __future__ import annotations

import json
from pathlib import Path

from agentz.core.async_compat import run_coroutine_sync
from agentz.core.intelligence import get_knowledge
from agentz.core.modes import ExecutionContext, Mode


def _copy_from_ctx(ctx: ExecutionContext) -> str:
    params = ctx.parameters or {}
    for field in ("linkedin", "text"):
        raw = params.get(field)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()

    bundle = params.get("bundle")
    if isinstance(bundle, str) and bundle.startswith("content/social/") and bundle.endswith(".json"):
        if ".." in bundle:
            return ""
        path = Path(bundle)
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            text = data.get("linkedin")
            if isinstance(text, str) and text.strip():
                return text.strip()
    return ""


def run(ctx: ExecutionContext) -> str:
    ctx.step("loading strategy for LinkedIn authority building")
    copy = _copy_from_ctx(ctx)
    strategy = copy or get_knowledge("ECOSYSTEM_STRATEGY")

    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would open linkedin.com/feed/")
        preview = (copy[:80] + "…") if copy else "The BMW Battery Passport"
        ctx.step(f"would post to LinkedIn: {preview}")
        return "dry-run: linkedin strategic post planned — no post sent"

    try:
        return run_coroutine_sync(lambda: _post_to_linkedin(ctx, strategy))
    except Exception as exc:
        return f"failed: {type(exc).__name__}: {exc}"


async def _post_to_linkedin(ctx: ExecutionContext, strategy: str) -> str:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
        from agentz.core.session_manager import get_browser_with_session
    except ImportError:
        return "failed: browser-use not installed"

    browser = get_browser_with_session(["linkedin_session"])
    task = f"""
    Navigate to linkedin.com. Use the existing session. Do not log in again if already signed in.
    Create a new post with this exact copy (do not invent prices or claims):

    {strategy}

    Submit the post and take a screenshot of the confirmation.
    """

    llm = ChatOllama(model="llama3.2")
    agent = Agent(task=task, llm=llm, browser=browser)
    await agent.run()
    return "success: posted to LinkedIn"
