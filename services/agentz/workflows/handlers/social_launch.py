"""
agentz.workflows.handlers.social_launch
--------------------------------------
Posts launch threads to social platforms (Reddit, LinkedIn, Twitter).
"""
import asyncio
from agentz.core.modes import ExecutionContext
from agentz.core.browser import run_with_healing, attach_interceptor

async def _run_post(ctx: ExecutionContext) -> str:
    wid = ctx.workflow_id
    
    # Map workflow ID to platform and content
    # In a real scenario, content would be pulled from a /content/ directory
    mapping = {
        "launch_post_authichain": ("reddit", "r/blockchain", "Authichain: The Autonomous Compliance Layer for Bitcoin"),
        "launch_post_qron": ("reddit", "r/QRcode", "QRON: Generative AI QR Codes for the On-Chain World"),
        "launch_post_strainchain": ("linkedin", "feed", "StrainChain: Immutable Cannabis Certifications on Bitcoin"),
        "launch_post_govchain": ("twitter", "home", "GovChain: The Autonomous Engine for SBIR/SVIP Government Grants"),
    }
    
    if wid not in mapping:
        return f"Unknown social launch task: {wid}"
        
    platform, target, title = mapping[wid]
    
    ctx.step(f"Launching on {platform} ({target}): {title}")
    
    # Simulate browser task for launch
    try:
        from browser_use import Agent, Controller
        from agentz.core.llm import get_llm
        from agentz.core.session_manager import get_browser_with_session
    except ImportError:
        ctx.step(f"WOULD: Browser agent posts to {platform} - {title}")
        return f"Launch simulation complete for {wid}"

    llm = get_llm(model="llama3.2", temperature=0.0)
    controller = Controller()
    attach_interceptor(controller, ctx)

    # Figure out the required credential key
    platform_key = f"{platform}_session"
    if platform == "twitter":
        platform_key = "twitter_session"
    browser = get_browser_with_session([platform_key])

    task = f"Navigate to {platform}.com, go to {target}, and create a post with title '{title}' and description 'Launching AgentZ-orchestrated {wid} today!'. Wait for success confirmation."
    
    agent = Agent(task=task, llm=llm, controller=controller, browser=browser)
    await run_with_healing(agent, ctx)
    
    return f"Launch post submitted to {platform}."

def run(ctx: ExecutionContext) -> str:
    return asyncio.run(_run_post(ctx))
