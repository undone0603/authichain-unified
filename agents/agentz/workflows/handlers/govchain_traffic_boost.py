"""
agentz.workflows.handlers.govchain_traffic_boost
-------------------------------------------
Organic traffic generation for GovChain.us Sovereign Document Passports.
"""
from __future__ import annotations
import asyncio
import os
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder

BUNDLE = {
    "linkedin": "🏛️ GovChain.us achieves 'Sovereign Document' status (CAGE 1PUJ6).\n\nWe are now deploying W3C Verifiable Credentials for federal and defense supply chains. Secure your credentials with FIPS 140-2 HSM-grade cryptographic truth and prevent state-level forgery in under 2 seconds.\n\nView the Sovereign Protocol: govchain.us\n\n#GovChain #FederalSecurity #W3C #VerifiableCredentials #CAGE1PUJ6",
    "reddit": { "subreddit": "supplychain", "title": "Deploying FIPS-grade W3C Verifiable Credentials for federal supply chains", "body": "Our protocol (CAGE 1PUJ6) just finalized its W3C VC implementation for sovereign documents. We use Ed25519 signatures and FIPS 140-2 compliance to secure credentials against state-level forgery. High-performance field verification in <2 seconds. Documentation: govchain.us" },
    "twitter": "1/ Federal supply chains are vulnerable to credential forgery. GovChain just fixed it.\n2/ Using W3C Verifiable Credentials and FIPS 140-2 HSM security to anchor sovereign truth.\n3/ Verified by CAGE Code 1PUJ6. Secure your federal document pipeline: govchain.us 🏛️"
}

def run(ctx: ExecutionContext) -> str:
    get_or_placeholder("linkedin_session", ctx)
    get_or_placeholder("reddit_session", ctx)
    get_or_placeholder("twitter_session", ctx)
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would post GovChain Sovereign Passports to LI, Reddit, and X")
        return "dry-run complete"
    return asyncio.run(_run_browser_task(ctx))

async def _run_browser_task(ctx: ExecutionContext) -> str:
    from browser_use import Agent
    from langchain_openai import ChatOpenAI
    
    class LLMWrapper:
        """Wrapper to add 'provider' and 'model' fields without breaking Pydantic validation."""
        def __init__(self, model, provider):
            self.llm = model
            self.provider = provider
            self.model = (
                getattr(model, "model_name", None) or 
                getattr(model, "model", None) or 
                "unknown-model"
            )
        def __getattr__(self, name):
            return getattr(self.llm, name)
        async def ainvoke(self, *args, **kwargs):
            return await self.llm.ainvoke(*args, **kwargs)
        def invoke(self, *args, **kwargs):
            return self.llm.invoke(*args, **kwargs)

    openai_key = os.environ.get("OPENAI_API_KEY")
    from browser_use import Browser, BrowserConfig
    browser = Browser(config=BrowserConfig(headless=True))
    llm = LLMWrapper(ChatOpenAI(model="gpt-4o", api_key=openai_key), "openai")
    task = f"Post to LinkedIn: {BUNDLE['linkedin']}\nPost to Reddit r/{BUNDLE['reddit']['subreddit']}: {BUNDLE['reddit']['title']}\n{BUNDLE['reddit']['body']}\nPost to Twitter/X: {BUNDLE['twitter']}"
    agent = Agent(task=task, llm=llm, browser=browser)
    await agent.run(max_steps=50)
    await browser.close()
    return "GovChain Traffic Boost complete."
