"""
agentz.workflows.handlers.qron_traffic_boost
-------------------------------------------
Organic traffic generation for QRON.space Dimensional Gateways.
"""
from __future__ import annotations
import asyncio
import os
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder

BUNDLE = {
    "linkedin": "🚀 QRON.space officially launches 'Dimensional Gateways'—the future of product engagement.\n\nOur AI-powered gateways drive 78% higher scan rates vs standard QR codes. Every gateway is cryptographically signed and anchored to the AuthiChain Protocol. Turn your physical product into a cinematic digital portal today.\n\nExplore the studio: qron.space\n\n#QRON #AIArt #ProductIdentity #Blockchain",
    "reddit": { "subreddit": "QRcode", "title": "Increasing QR scan rates by 78% with AI-generated 'Dimensional Gateways'", "body": "I've been building a studio that replaces flat QR codes with AI-generated cinematic gateways. Data shows consumers engage significantly more when the code is part of the product's visual story. Every code is cryptographically signed using Ed25519. Check out the generator: qron.space" },
    "twitter": "1/ Standard QR codes are dead. Consumers ignore them.\n2/ QRON just launched 'Dimensional Gateways'—AI art that drives 78% higher engagement.\n3/ Every gateway is cryptographically signed and anchored to AuthiChain. Build your portal: qron.space 🌌"
}

def run(ctx: ExecutionContext) -> str:
    get_or_placeholder("linkedin_session", ctx)
    get_or_placeholder("reddit_session", ctx)
    get_or_placeholder("twitter_session", ctx)
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would post QRON Dimensional Gateways to LI, Reddit, and X")
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
    return "QRON Traffic Boost complete."
