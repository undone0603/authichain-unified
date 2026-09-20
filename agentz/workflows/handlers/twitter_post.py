"""
agentz.workflows.handlers.twitter_post
-------------------------------------
Automates high-fidelity threads on X (Twitter) using the AgentZ template library.
"""
from agentz.core.async_compat import run_coroutine_sync
from agentz.core.intelligence import get_knowledge
from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    ctx.step("loading outreach templates for Twitter/X")
    templates = get_knowledge("OUTREACH_TEMPLATES")

    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would open x.com")
        ctx.step("would post thread: 'The Truth Layer Economy'")
        return "dry-run: twitter thread planned — no post sent"

    try:
        return run_coroutine_sync(lambda: _post_to_twitter(ctx, templates))
    except Exception as exc:
        return f"failed: {type(exc).__name__}: {exc}"


async def _post_to_twitter(ctx: ExecutionContext, templates: str) -> str:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
    except ImportError:
        return "failed: browser-use not installed"

    task = f"""
    Navigate to x.com. Login if necessary.
    Create a new thread based on 'Template 3' from these templates:

    {templates}

    Ensure the thread is formatted correctly (1/N, 2/N, etc.).
    Post the thread and take a screenshot.
    """

    llm = ChatOllama(model="llama3.2")
    agent = Agent(task=task, llm=llm)
    await agent.run()
    return "success: posted thread to X"
