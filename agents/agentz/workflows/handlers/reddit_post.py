"""
agentz.workflows.handlers.reddit_post
------------------------------------
Automates social proof distribution via Reddit.
Targets relevant industry subreddits (r/blockchain, r/agtech, r/supplychain).
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.intelligence import get_knowledge

def run(ctx: ExecutionContext) -> str:
    ctx.step("loading truth layer strategy for Reddit positioning")
    strategy = get_knowledge("ECOSYSTEM_STRATEGY")
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would target r/blockchain and r/supplychain")
        ctx.step("would draft post on 'The Input Trust Problem'")
        return "dry-run: reddit social proof planned"

    return asyncio.run(_post_to_reddit(ctx, strategy))

async def _post_to_reddit(ctx: ExecutionContext, strategy: str) -> str:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
    except ImportError:
        return "failed: browser-use not installed"

    task = f"""
    Navigate to reddit.com. Login if necessary.
    Find r/blockchain or r/supplychain.
    Create a high-value educational post based on this strategy:
    {strategy}
    
    Focus on how AuthiChain solves 'Man-in-the-middle' physical attacks.
    Do NOT make it look like an ad. Focus on technical problem solving.
    Submit and take a screenshot.
    """
    
    llm = ChatOllama(model="llama3.2")
    agent = Agent(task=task, llm=llm)
    await agent.run()
    
    return "successfully posted social proof to Reddit"
