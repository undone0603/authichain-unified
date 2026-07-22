"""
agentz.workflows.handlers.strainchain_traffic_boost
-------------------------------------------
Organic traffic generation for StrainChain.io Seed-to-Sale Truth Layer.
"""
from __future__ import annotations
import asyncio
import os
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder

BUNDLE = {
    "linkedin": "🌿 StrainChain.io is now the automated 'Truth Layer' for Michigan cannabis.\n\nOur new background job automatically anchors METRC manifests to Bitcoin L1. Cultivators now receive an immutable 'Proof of Purity' certificate for every package tag, eliminating 80% of manual audit labor.\n\nVerify your provenance: strainchain.io\n\n#StrainChain #CannabisCompliance #BitcoinL1 #METRC",
    "reddit": { "subreddit": "supplychain", "title": "Automating METRC audits with Bitcoin L1 anchoring (StrainChain)", "body": "We just launched a background job that pulls Michigan METRC manifests and anchors them to Bitcoin L1 in real-time. This creates a permanent 'Proof of Purity' for every batch that regulators can verify in seconds. Would love to hear from other MSOs on the legal implications: strainchain.io" },
    "twitter": "1/ Manual METRC audits take hundreds of hours per quarter. Not anymore.\n2/ StrainChain now automatically anchors Michigan cannabis manifests to Bitcoin L1.\n3/ Get your 'Proof of Purity' certificate and automate your CRA reporting: strainchain.io 🌿"
}

def run(ctx: ExecutionContext) -> str:
    get_or_placeholder("linkedin_session", ctx)
    get_or_placeholder("reddit_session", ctx)
    get_or_placeholder("twitter_session", ctx)
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would post StrainChain Truth Layer to LI, Reddit, and X")
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
    return "StrainChain Traffic Boost complete."
