"""
agentz.workflows.handlers.pinecone_trial
--------------------------------------
Composite handler for Pinecone trial migration.
Uses one agent to research current usage and another to decide/migrate.
"""
from __future__ import annotations

import asyncio
from agentz.core.modes import ExecutionContext
from agentz.core.browser import run_with_healing, attach_interceptor

async def _run_composite(ctx: ExecutionContext) -> str:
    try:
        from browser_use import Agent, Controller
        from agentz.core.llm import get_llm
    except ImportError:
        return "browser-use not installed"

    llm = get_llm(model="llama3.2", temperature=0.0)
    controller = Controller()
    attach_interceptor(controller, ctx)

    # 1. RESEARCH PHASE
    ctx.step("Phase 1: Research current Pinecone usage")
    research_task = "Go to Pinecone dashboard, find the 'gov-opportunities' index, and record its dimensions and current vector count."
    research_agent = Agent(task=research_task, llm=llm, controller=controller)
    research_history = await run_with_healing(research_agent, ctx)
    research_results = research_history.final_result() or "Unknown usage"

    # 2. DECISION & EXECUTION PHASE
    ctx.step(f"Phase 2: Decision & Execution (Research: {research_results})")
    execution_task = f"""
Based on research: {research_results}
If vector count < 100,000, we will stay on the free tier but optimize the index.
If > 100,000, we need to migrate to Supabase pgvector.
For this simulation: Just navigate to the index settings and click 'Optimize' if available, otherwise just exit.
"""
    execution_agent = Agent(task=execution_task, llm=llm, controller=controller)
    await run_with_healing(execution_agent, ctx)

    return f"Pinecone handled. Research: {research_results}"

def run(ctx: ExecutionContext) -> str:
    if ctx.mode == "dry-run":
        ctx.step("Research Pinecone usage")
        ctx.step("Decide: Optimize or Migrate")
        return "dry-run complete"
    
    return asyncio.run(_run_composite(ctx))
