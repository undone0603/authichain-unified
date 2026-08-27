"""
agentz.workflows.handlers.shopify_setup
--------------------------------------
Drafts a Shopify App Store presence for 'AuthiChain Truth Layer'.
"""
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.intelligence import get_ecosystem_context

def run(ctx: ExecutionContext) -> str:
    ctx.step("loading ecosystem context for Shopify value prop")
    context = get_ecosystem_context()
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would navigate to Shopify Partner Dashboard")
        ctx.step("would create draft listing: 'AuthiChain Truth Layer'")
        ctx.step("would set pricing: $49/mo + $0.05 per code")
        return "dry-run: shopify listing draft planned"

    return asyncio.run(_create_shopify_draft(ctx, context))

async def _create_shopify_draft(ctx: ExecutionContext, context: str) -> str:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
    except ImportError:
        return "failed: browser-use not installed"

    task = f"""
    Navigate to the Shopify Partner Dashboard (partners.shopify.com).
    Login if necessary.
    Go to 'Apps' -> 'Create App'.
    Set the App name to 'AuthiChain Truth Layer'.
    Use this strategic context to fill in the description and value props:
    {context}
    
    Focus on: Preventing return fraud using QRON-signed package seals.
    Save as draft. Do NOT submit for review.
    """
    
    llm = ChatOllama(model="llama3.2")
    agent = Agent(task=task, llm=llm)
    await agent.run()
    
    return "successfully created shopify app draft"
