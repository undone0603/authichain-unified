"""
agentz.workflows.handlers.linkedin_post
--------------------------------------
Automates high-fidelity strategic posts on LinkedIn.
"""
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.intelligence import get_knowledge

def run(ctx: ExecutionContext) -> str:
    ctx.step("loading strategy for LinkedIn authority building")
    strategy = get_knowledge("ECOSYSTEM_STRATEGY")
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would open linkedin.com/feed/")
        ctx.step("would post strategic case study: 'The BMW Battery Passport'")
        return "dry-run: linkedin strategic post planned"

    return asyncio.run(_post_to_linkedin(ctx, strategy))

async def _post_to_linkedin(ctx: ExecutionContext, strategy: str) -> str:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
    except ImportError:
        return "failed: browser-use not installed"

    task = f"""
    Navigate to linkedin.com. Login if necessary.
    Create a new post based on this strategy:
    {strategy}
    
    Focus on: How cryptographically-signed provenance solves the 'Input Trust' problem.
    Use an authoritative, enterprise tone.
    Submit and take a screenshot.
    """
    
    llm = ChatOllama(model="llama3.2")
    agent = Agent(task=task, llm=llm)
    await agent.run()
    
    return "successfully posted to LinkedIn"
