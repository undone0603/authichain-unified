"""
agentz.workflows.handlers.twitter_post
-------------------------------------
Automates high-fidelity threads on X (Twitter) using the AgentZ template library.
"""
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.intelligence import get_knowledge

def run(ctx: ExecutionContext) -> str:
    ctx.step("loading outreach templates for Twitter/X")
    templates = get_knowledge("OUTREACH_TEMPLATES")
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would open x.com")
        ctx.step("would post thread: 'The Truth Layer Economy'")
        return "dry-run: twitter thread planned"

    return asyncio.run(_post_to_twitter(ctx, templates))

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
    
    return "successfully posted thread to X"
