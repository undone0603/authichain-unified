"""
agentz.workflows.handlers.grant_application
-------------------------------------------
Generic handler for submitting technical grants (Arbitrum, Polygon, Ethereum).
Loads technical narratives from the AgentZ Knowledge Base.
"""
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.intelligence import get_knowledge

def run(ctx: ExecutionContext) -> str:
    # Identify which grant we are submitting based on the workflow ID
    grant_key = "arbitrum"
    if "polygon" in ctx.workflow_id:
        grant_key = "polygon"
    elif "ethereum" in ctx.workflow_id:
        grant_key = "ethereum"
        
    ctx.step(f"loading grant narratives for {grant_key}")
    narratives = get_knowledge("GRANT_NARRATIVES")
    
    # Extract relevant section (simulated extraction)
    # In a real scenario, we'd use an LLM or regex to get the specific block.
    
    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"would navigate to {grant_key} foundation portal")
        ctx.step(f"would fill application with narratives from KNOWLEDGE_BASE")
        return f"dry-run: {grant_key} grant submission planned"

    return asyncio.run(_submit_grant(ctx, grant_key, narratives))

async def _submit_grant(ctx: ExecutionContext, key: str, narratives: str) -> str:
    try:
        from browser_use import Agent
        from langchain_ollama import ChatOllama
    except ImportError:
        return "failed: browser-use not installed"

    urls = {
        "arbitrum": "https://arbitrum.foundation/grants",
        "polygon": "https://polygon.technology/grants",
        "ethereum": "https://ethereum.org/en/community/grants/",
    }

    task = f"""
    Navigate to {urls.get(key, 'the foundation portal')}.
    Find the application form for technical/ecosystem grants.
    Use the following narratives to fill out the form:
    
    {narratives}
    
    Focus on the '{key}' specific section if available.
    Submit the application and take a screenshot of the confirmation.
    """
    
    llm = ChatOllama(model="llama3.2")
    agent = Agent(task=task, llm=llm)
    await agent.run()
    
    return f"successfully submitted {key} grant application"
